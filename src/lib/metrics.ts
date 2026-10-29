import { SessionLog, TrainingMode } from '../types/schema';

export interface FiveAxisMetrics {
  effectiveWpm: number;     // eWPM = rawWpm * syncRate
  fixationMs: number;       // Average ms per chunk
  perceptualSpan: number;   // Average words per chunk
  forwardFlowRate: number;  // 0.0 to 1.0 (no regression ratio)
  syncRate: number;         // 0.0 to 1.0 (comprehension accuracy)
}

export interface BenchmarkComparison {
  zScore: number;
  topPercentile: number;    // L1 Native distribution N(238, 51): e.g. 8.4 means TOP 8.4%
  l2ZScore: number;
  l2TopPercentile: number;  // L2 Non-native distribution N(145, 42): e.g. 12.5 means TOP 12.5%
  rankLabel:
    | 'APEX // L1 TOP 1%'
    | 'PRO // L1 TOP 10%'
    | 'NATIVE STANDARD'
    | 'L2 ADVANCED // TOP 25%'
    | 'CALIBRATING';
  weakestAxis: keyof FiveAxisMetrics;
  recommendedMode: TrainingMode;
  diagnosisText: string;
}

/**
 * Error function approximation (Abramowitz and Stegun 7.1.26)
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Calculates human percentiles from eWPM against both:
 * - L1 Native English Readers: N(mu = 238, sigma = 51) (Brysbaert 2019)
 * - L2 Global Non-Native English Readers: N(mu = 145, sigma = 42)
 */
export function calculateHumanBenchmark(
  metrics: FiveAxisMetrics
): BenchmarkComparison {
  const mu = 238;
  const sigma = 51;
  const zScore = (metrics.effectiveWpm - mu) / sigma;

  // Cumulative normal distribution Phi(z) = 0.5 * (1 + erf(z / sqrt(2)))
  const cdf = 0.5 * (1 + erf(zScore / Math.SQRT2));
  const rawTopPercent = Math.max(0.1, Math.min(99.9, (1 - cdf) * 100));
  const topPercentile = Math.round(rawTopPercent * 10) / 10;

  // L2 Global English Reader benchmark: N(mu = 145, sigma = 42)
  const l2Mu = 145;
  const l2Sigma = 42;
  const l2ZScore = (metrics.effectiveWpm - l2Mu) / l2Sigma;
  const l2Cdf = 0.5 * (1 + erf(l2ZScore / Math.SQRT2));
  const rawL2TopPercent = Math.max(0.1, Math.min(99.9, (1 - l2Cdf) * 100));
  const l2TopPercentile = Math.round(rawL2TopPercent * 10) / 10;

  let rankLabel: BenchmarkComparison['rankLabel'] = 'CALIBRATING';
  if (topPercentile <= 1.5 || metrics.effectiveWpm >= 450) {
    rankLabel = 'APEX // L1 TOP 1%';
  } else if (topPercentile <= 10.5 || metrics.effectiveWpm >= 320) {
    rankLabel = 'PRO // L1 TOP 10%';
  } else if (metrics.effectiveWpm >= 210) {
    rankLabel = 'NATIVE STANDARD';
  } else if (l2TopPercentile <= 25.0 || metrics.effectiveWpm >= 175) {
    rankLabel = 'L2 ADVANCED // TOP 25%';
  }

  // Normalize each axis (0..100 where 50 is Human Native Avg) to detect bottleneck
  const normalizedScores: Record<keyof FiveAxisMetrics, number> = {
    effectiveWpm: normalizeAxis(metrics.effectiveWpm, 135, 238, 450),
    fixationMs: normalizeInverseAxis(metrics.fixationMs, 320, 225, 140),
    perceptualSpan: normalizeAxis(metrics.perceptualSpan, 1.2, 2.5, 4.5),
    forwardFlowRate: normalizeAxis(metrics.forwardFlowRate * 100, 75, 88, 98),
    syncRate: normalizeAxis(metrics.syncRate * 100, 65, 80, 95),
  };

  let weakestAxis: keyof FiveAxisMetrics = 'effectiveWpm';
  let minScore = Infinity;
  const axes: Array<keyof FiveAxisMetrics> = [
    'effectiveWpm',
    'fixationMs',
    'perceptualSpan',
    'forwardFlowRate',
    'syncRate',
  ];
  for (const axis of axes) {
    if (normalizedScores[axis] < minScore) {
      minScore = normalizedScores[axis];
      weakestAxis = axis;
    }
  }

  let recommendedMode: TrainingMode = 'chunk_pacer';
  let diagnosisText =
    'Maintain semantic chunk pacing to stabilize forward reading rhythm.';

  if (weakestAxis === 'fixationMs') {
    recommendedMode = 'lexical_anchor';
    diagnosisText =
      'Bottleneck: Fixation speed. Use LEXICAL ANCHOR or TACHISTOSCOPE to recognize words from leading root anchors.';
  } else if (weakestAxis === 'perceptualSpan') {
    recommendedMode = 'tachistoscope';
    diagnosisText =
      'Bottleneck: Perceptual span. Use TACHISTOSCOPE FLASH to expand multi-word peripheral intake.';
  } else if (weakestAxis === 'forwardFlowRate') {
    recommendedMode = 'saccade_rail';
    diagnosisText =
      'Bottleneck: Forward gaze rhythm. Use SACCADE RAIL or CHUNK PACER to lock in steady left-to-right saccades.';
  } else if (weakestAxis === 'syncRate') {
    recommendedMode = 'syntax_skimmer';
    diagnosisText =
      'Bottleneck: Structural comprehension. Use SYNTAX SKIMMER to isolate S-V-O content words and discourse markers.';
  } else {
    recommendedMode = 'rsvp';
    diagnosisText =
      'Bottleneck: Subvocalization & saccade latency. Use RSVP STREAM at the ORP reticle to push throughput.';
  }

  return {
    zScore,
    topPercentile,
    l2ZScore,
    l2TopPercentile,
    rankLabel,
    weakestAxis,
    recommendedMode,
    diagnosisText,
  };
}

export type CoachRotationMode = TrainingMode;

export interface CoachPrescription {
  nextMode: CoachRotationMode;
  fadeOutPassed: boolean;
  weakestAxis: keyof FiveAxisMetrics;
  bottleneckLabel: string;
  rationale: string;
  axisScores: Record<keyof FiveAxisMetrics, number>;
}

/**
 * Selects the optimal next mode among all 6 complementary ESL training engines
 * (`chunk_pacer`, `syntax_skimmer`, `lexical_anchor`, `saccade_rail`, `rsvp`, `tachistoscope`)
 * by analyzing the user's 5-axis weakness telemetry and enforcing anti-stagnation rotation.
 */
export function computeGuidedCoachPrescription(params: {
  lastMetrics: FiveAxisMetrics | null;
  recentModes: TrainingMode[];
}): CoachPrescription {
  const { lastMetrics, recentModes } = params;

  if (!lastMetrics) {
    return {
      nextMode: 'chunk_pacer',
      fadeOutPassed: false,
      weakestAxis: 'effectiveWpm',
      bottleneckLabel: 'INITIAL RHYTHM CALIBRATION',
      rationale:
        'Start with CHUNK PACER to establish semantic chunking rhythm before rotating across all 6 ESL training engines.',
      axisScores: {
        effectiveWpm: 50,
        fixationMs: 50,
        perceptualSpan: 50,
        forwardFlowRate: 50,
        syncRate: 50,
      },
    };
  }

  const axisScores: Record<keyof FiveAxisMetrics, number> = {
    effectiveWpm: normalizeAxis(lastMetrics.effectiveWpm, 135, 238, 450),
    fixationMs: normalizeInverseAxis(lastMetrics.fixationMs, 320, 225, 140),
    perceptualSpan: normalizeAxis(lastMetrics.perceptualSpan, 1.2, 2.5, 4.5),
    forwardFlowRate: normalizeAxis(lastMetrics.forwardFlowRate * 100, 75, 88, 98),
    syncRate: normalizeAxis(lastMetrics.syncRate * 100, 65, 80, 95),
  };

  const lastMode = recentModes[0] || null;

  // If comprehension dropped below 65%, consolidate in SYNTAX SKIMMER or CHUNK PACER first
  if (
    lastMetrics.syncRate < 0.65 &&
    lastMode !== 'syntax_skimmer' &&
    lastMode !== 'chunk_pacer'
  ) {
    const recoveryMode: CoachRotationMode =
      recentModes.includes('syntax_skimmer') ? 'chunk_pacer' : 'syntax_skimmer';
    return {
      nextMode: recoveryMode,
      fadeOutPassed: lastMetrics.forwardFlowRate < 0.9,
      weakestAxis: 'syncRate',
      bottleneckLabel: 'STRUCTURAL SYNC RECOVERY',
      rationale:
        recoveryMode === 'syntax_skimmer'
          ? 'Comprehension dipped below threshold — rotating to SYNTAX SKIMMER to highlight content-word S-V-O structure and discourse markers.'
          : 'Comprehension dipped below threshold — rotating to CHUNK PACER to stabilize meaning retention.',
      axisScores,
    };
  }

  // Evaluate weakness need (lower score = higher priority) across all 6 complementary ESL modes:
  const candidates: Array<{
    mode: CoachRotationMode;
    score: number;
    weakestAxis: keyof FiveAxisMetrics;
    bottleneckLabel: string;
    rationale: string;
  }> = [
    {
      mode: 'chunk_pacer',
      score: Math.round(
        axisScores.forwardFlowRate * 0.6 + axisScores.syncRate * 0.4
      ),
      weakestAxis: 'forwardFlowRate',
      bottleneckLabel: 'FORWARD GAZE FLOW (ANTI-REGRESSION)',
      rationale:
        'CHUNK PACER (with Fade-Out) trains steady left-to-right semantic chunk intake without look-backs.',
    },
    {
      mode: 'syntax_skimmer',
      score: Math.round(
        axisScores.syncRate * 0.7 + axisScores.effectiveWpm * 0.3
      ),
      weakestAxis: 'syncRate',
      bottleneckLabel: 'SYNTACTIC SKELETON & DISCOURSE LOGIC',
      rationale:
        'SYNTAX SKIMMER dims low-cost function words so nouns, main verbs, and contrast markers jump out immediately.',
    },
    {
      mode: 'lexical_anchor',
      score: Math.round(
        axisScores.fixationMs * 0.65 + axisScores.effectiveWpm * 0.35
      ),
      weakestAxis: 'fixationMs',
      bottleneckLabel: 'WORD-INITIAL LEXICAL PREDICTION',
      rationale:
        'LEXICAL ANCHOR highlights leading root characters so you recognize long words instantly without spelling out suffixes.',
    },
    {
      mode: 'saccade_rail',
      score: Math.round(
        axisScores.forwardFlowRate * 0.5 + axisScores.perceptualSpan * 0.5
      ),
      weakestAxis:
        axisScores.forwardFlowRate <= axisScores.perceptualSpan
          ? 'forwardFlowRate'
          : 'perceptualSpan',
      bottleneckLabel: '3-RAIL SACCADIC CADENCE & RETURN SWEEP',
      rationale:
        'SACCADE RAIL aligns phrases onto 3 fixed horizontal landing rails to build automatic 3-beat eye jumps across each line.',
    },
    {
      mode: 'rsvp',
      score: Math.round(
        axisScores.effectiveWpm * 0.75 + axisScores.forwardFlowRate * 0.25
      ),
      weakestAxis: 'effectiveWpm',
      bottleneckLabel: 'SUBVOCALIZATION & SACCADE CEILING',
      rationale:
        'RSVP STREAM locks your gaze to the Optimal Recognition Point (ORP) to bypass inner speech and accelerate WPM.',
    },
    {
      mode: 'tachistoscope',
      score: Math.round(
        axisScores.perceptualSpan * 0.6 + axisScores.fixationMs * 0.4
      ),
      weakestAxis:
        axisScores.perceptualSpan <= axisScores.fixationMs
          ? 'perceptualSpan'
          : 'fixationMs',
      bottleneckLabel: 'PERIPHERAL SNAPSHOT SPAN',
      rationale:
        'TACHISTOSCOPE flashes chunks briefly (140–250ms) so you absorb 3–4 words in a single peripheral glance.',
    },
  ];

  // Apply recency penalties so Coach rotates smoothly across all 6 engines:
  // - Never repeat `lastMode` back-to-back (+1000 penalty)
  // - Penalize recently played modes in decaying order so all 6 modes see active rotation
  const recencyPenalties = [1000, 26, 16, 10, 5];
  const scoredCandidates = candidates
    .map((c) => {
      let effectiveScore = c.score;
      const recencyIdx = recentModes.indexOf(c.mode);
      if (recencyIdx !== -1 && recencyIdx < recencyPenalties.length) {
        effectiveScore += recencyPenalties[recencyIdx];
      }
      return { ...c, effectiveScore };
    })
    .sort((a, b) => a.effectiveScore - b.effectiveScore);

  const chosen = scoredCandidates[0];
  const fadeOutPassed =
    chosen.mode === 'chunk_pacer' ||
    chosen.mode === 'syntax_skimmer' ||
    chosen.mode === 'lexical_anchor' ||
    chosen.mode === 'saccade_rail'
      ? lastMetrics.forwardFlowRate < 0.94 || recentModes.length >= 1
      : true;

  return {
    nextMode: chosen.mode,
    fadeOutPassed,
    weakestAxis: chosen.weakestAxis,
    bottleneckLabel: chosen.bottleneckLabel,
    rationale: chosen.rationale,
    axisScores,
  };
}

/**
 * Normalize metric onto a 0..100 radar scale where:
 * nonNativeAvg -> 30, nativeAvg -> 60, apex -> 98
 */
export function normalizeAxis(
  val: number,
  nonNative: number,
  nativeAvg: number,
  apex: number
): number {
  if (val <= nonNative) {
    return Math.max(10, Math.round((val / nonNative) * 30));
  }
  if (val <= nativeAvg) {
    const ratio = (val - nonNative) / (nativeAvg - nonNative);
    return Math.round(30 + ratio * 30);
  }
  const ratio = Math.min(1.15, (val - nativeAvg) / (apex - nativeAvg));
  return Math.min(100, Math.round(60 + ratio * 38));
}

export function normalizeInverseAxis(
  val: number,
  slowNonNative: number,
  nativeAvg: number,
  fastApex: number
): number {
  if (val >= slowNonNative) {
    return Math.max(10, Math.round((slowNonNative / val) * 30));
  }
  if (val >= nativeAvg) {
    const ratio = (slowNonNative - val) / (slowNonNative - nativeAvg);
    return Math.round(30 + ratio * 30);
  }
  const ratio = Math.min(1.15, (nativeAvg - val) / (nativeAvg - fastApex));
  return Math.min(100, Math.round(60 + ratio * 38));
}

/**
 * Section 7.2: Adaptive Target WPM Controller
 */
export function computeNextTargetWpm(
  currentTargetWpm: number,
  syncRate: number,
  forwardFlowRate: number
): { nextWpm: number; status: 'OVERCLOCK (+5%)' | 'FLOW STATE (HOLD)' | 'DESYNC (-5%)' } {
  if (syncRate >= 0.85 && forwardFlowRate >= 0.9) {
    return {
      nextWpm: Math.min(900, Math.round(currentTargetWpm * 1.05)),
      status: 'OVERCLOCK (+5%)',
    };
  }
  if (syncRate < 0.7) {
    return {
      nextWpm: Math.max(60, Math.round(currentTargetWpm * 0.95)),
      status: 'DESYNC (-5%)',
    };
  }
  return {
    nextWpm: currentTargetWpm,
    status: 'FLOW STATE (HOLD)',
  };
}

export function buildRadarPolygonPoints(
  values: [number, number, number, number, number],
  radius: number,
  center: number
): string {
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = (Math.max(5, Math.min(100, v)) / 100) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function summarizeSessionMetrics(log: SessionLog): FiveAxisMetrics {
  return {
    effectiveWpm: log.effectiveWpm,
    fixationMs: log.fixationMs,
    perceptualSpan: log.perceptualSpan,
    forwardFlowRate: log.forwardFlowRate,
    syncRate: log.syncRate,
  };
}
