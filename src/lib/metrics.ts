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
  topPercentile: number;    // e.g. 8.4 means TOP 8.4%
  rankLabel: 'APEX // TOP 1%' | 'PRO // TOP 10%' | 'NATIVE STANDARD' | 'CALIBRATING';
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
 * Calculates human percentile from eWPM using N(mu = 238, sigma = 51)
 * Section 3: Z = (eWPM - 238) / 51
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

  let rankLabel: BenchmarkComparison['rankLabel'] = 'CALIBRATING';
  if (topPercentile <= 1.5 || metrics.effectiveWpm >= 450) {
    rankLabel = 'APEX // TOP 1%';
  } else if (topPercentile <= 10.5 || metrics.effectiveWpm >= 320) {
    rankLabel = 'PRO // TOP 10%';
  } else if (metrics.effectiveWpm >= 210) {
    rankLabel = 'NATIVE STANDARD';
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
    recommendedMode = 'tachistoscope';
    diagnosisText =
      'Bottleneck: Fixation speed. Use TACHISTOSCOPE FLASH to compress per-chunk recognition time.';
  } else if (weakestAxis === 'forwardFlowRate') {
    recommendedMode = 'chunk_pacer';
    diagnosisText =
      'Bottleneck: Regression rate. Use CHUNK PACER with Fade-Out enabled to eliminate backward saccades.';
  } else if (weakestAxis === 'perceptualSpan') {
    recommendedMode = 'rsvp';
    diagnosisText =
      'Bottleneck: Perceptual span. Use RSVP STREAM to process multi-word units at a fixed pivot.';
  } else if (weakestAxis === 'syncRate') {
    recommendedMode = 'chunk_pacer';
    diagnosisText =
      'Bottleneck: Semantic retention. Consolidate comprehension in CHUNK PACER before pushing clock rate.';
  } else {
    recommendedMode = 'overclock_432';
    diagnosisText =
      'Bottleneck: Raw throughput ceiling. Engage 4/3/2 OVERCLOCK time-compression passes.';
  }

  return {
    zScore,
    topPercentile,
    rankLabel,
    weakestAxis,
    recommendedMode,
    diagnosisText,
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
      nextWpm: Math.max(100, Math.round(currentTargetWpm * 0.95)),
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
