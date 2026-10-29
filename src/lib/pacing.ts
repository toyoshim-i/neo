import { QuizQuestion, TrainingMode } from '../types/schema';

export type ScreenState =
  | 'title'
  | 'home'
  | 'preview'
  | 'reading'
  | 'quiz'
  | 'result';

export type AppExperienceMode = 'guided' | 'freeplay';
export type PassageModalTab = 'presets' | 'live' | 'custom';

export const MODE_INFO: Record<
  TrainingMode,
  { label: string; shortTag: string; shortDesc: string }
> = {
  chunk_pacer: {
    label: 'CHUNK PACER',
    shortTag: 'FLOW & ANTI-REGRESSION',
    shortDesc:
      'Full paragraph view with auto-advancing 2–4 word semantic highlights and anti-regression fade.',
  },
  syntax_skimmer: {
    label: 'SYNTAX SKIMMER',
    shortTag: 'S-V-O & LOGIC SKELETON',
    shortDesc:
      'Dims low-cost function words so content words (nouns/verbs) and discourse markers pop out as a structural skeleton.',
  },
  lexical_anchor: {
    label: 'LEXICAL ANCHOR',
    shortTag: 'WORD-INITIAL PREDICTION',
    shortDesc:
      'Emphasizes the leading root letters of content words so your brain predicts whole words without spelling out suffixes.',
  },
  saccade_rail: {
    label: 'SACCADE RAIL',
    shortTag: '3-COLUMN RHYTHMIC JUMP',
    shortDesc:
      'Aligns chunks onto 3 fixed horizontal fixation rails (Left · Center · Right) to train rhythmic saccades and return sweeps.',
  },
  rsvp: {
    label: 'RSVP STREAM',
    shortTag: 'SUBVOCAL SUPPRESSION',
    shortDesc:
      'Lock your gaze at the center ORP reticle as chunks stream sequentially to bypass inner speech.',
  },
  tachistoscope: {
    label: 'TACHISTOSCOPE',
    shortTag: 'PERIPHERAL FLASH SPAN',
    shortDesc:
      'Flash 3–4 word phrases for ~170ms to train parallel parafoveal recognition.',
  },
};

/**
 * Randomly samples `sampleCount` (default 3) questions from a passage's question pool
 * using Fisher-Yates shuffle, and randomizes the 4 answer choices for each sampled question.
 */
export function shuffleQuizQuestions(
  questions: QuizQuestion[],
  sampleCount = 3
): QuizQuestion[] {
  const pool = [...questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const sampled = pool.slice(0, Math.max(1, Math.min(sampleCount, pool.length)));

  return sampled.map((q) => {
    const pairs = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
    }));
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pairs[i];
      pairs[i] = pairs[j];
      pairs[j] = tmp;
    }
    const newOptions = pairs.map((p) => p.text) as [
      string,
      string,
      string,
      string,
    ];
    const newCorrectIndex = Math.max(
      0,
      pairs.findIndex((p) => p.isCorrect)
    );
    return {
      ...q,
      options: newOptions,
      correctIndex: newCorrectIndex,
    };
  });
}

// Low-cost function words (articles, short prepositions, auxiliaries, conjunctions)
// absorbed parafoveally with minimal cognitive fixation cost (Rayner, 1998).
export const LOW_COST_FUNCTION_WORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'upon',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'am',
  'or',
  'and',
  'but',
  'nor',
  'so',
  'yet',
  'if',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'do',
  'does',
  'did',
  'can',
  'may',
  'not',
]);

/**
 * Computes the cognitive & visual fixation weight of a single chunk:
 * - Base oculomotor saccade landing cost (0.65 standard word units) so short chunks never flash past instantaneously.
 * - Articles ('a', 'an', 'the') carry near-zero lexical weight (0.18).
 * - Short function words carry discounted weight (0.32).
 * - Content words scale smoothly with character length: (charLen / 5.2) ^ 1.12, giving long compound/academic words
 *   sufficient decoding time while keeping short content words brisk.
 * - Gentle punctuation wrap-up pause (+15% sentence-end, +7% clause comma) instead of jarring 1.45x-1.8x freezes.
 */
export function computeChunkCognitiveWeight(
  chunk: string,
  mode: TrainingMode
): number {
  const tokens = chunk.trim().split(/\s+/).filter(Boolean);
  let lexicalLoad = 0;

  for (const rawToken of tokens) {
    const clean = rawToken.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (!clean) continue;

    if (clean === 'a' || clean === 'an' || clean === 'the') {
      lexicalLoad += 0.18;
    } else if (LOW_COST_FUNCTION_WORDS.has(clean)) {
      lexicalLoad += 0.32;
    } else {
      const charLen = Math.max(2, clean.length);
      lexicalLoad += Math.pow(charLen / 5.2, 1.12);
    }
  }

  let weight = 0.65 + lexicalLoad;

  if (/[.!?]["'”’)]*$/.test(chunk)) {
    weight *= mode === 'rsvp' ? 1.32 : 1.15;
  } else if (/[,;:—]["'”’)]*$/.test(chunk)) {
    weight *= mode === 'rsvp' ? 1.16 : 1.07;
  }

  return weight;
}

/**
 * Blends the player's recorded per-chunk durations from a Personal Best run (50%)
 * with the theoretical fluent cognitive weights (50%), after clamping outlier
 * stumbles/freezes to [0.55x, 1.65x] of the ideal weight.
 * This preserves the player's natural breathing & phrasing rhythm while ironing out
 * accidental lexical stumbles so bad habits are never baked into the Ghost pacemaker.
 */
export function buildSmoothedGhostWeights(
  chunks: string[],
  recordedDurationsMs: number[],
  mode: TrainingMode
): number[] {
  const idealWeights = chunks.map((c) => computeChunkCognitiveWeight(c, mode));
  if (recordedDurationsMs.length !== chunks.length || chunks.length === 0) {
    return idealWeights;
  }

  const totalIdeal = idealWeights.reduce((a, b) => a + b, 0) || 1;
  const totalRecorded =
    recordedDurationsMs.reduce((a, b) => a + Math.max(40, b), 0) || 1;

  return idealWeights.map((ideal, idx) => {
    const rawMs = Math.max(40, recordedDurationsMs[idx] || 0);
    // Normalize player's chunk duration onto the same total weight scale as `idealWeights`
    const normalizedPlayerWeight = (rawMs / totalRecorded) * totalIdeal;
    // Clamp extreme stumbles or accidental double-taps to [0.55x, 1.65x] of ideal weight
    const clampedPlayer = Math.max(
      ideal * 0.55,
      Math.min(ideal * 1.65, normalizedPlayerWeight)
    );
    // 50% ideal cognitive curve + 50% clamped player cadence
    return Number((ideal * 0.5 + clampedPlayer * 0.5).toFixed(3));
  });
}

/**
 * Computes the exact millisecond duration for `chunkIndex` such that:
 * 1. Every chunk's duration is proportional to `customWeights` (if a PB Ghost profile exists)
 *    or its character/lexical cognitive weight.
 * 2. The sum of all chunk durations across the passage equals the exact total time for `activeWpm`.
 */
export function computeChunkDurationMs(
  chunks: string[],
  chunkIndex: number,
  totalWords: number,
  activeWpm: number,
  mode: TrainingMode,
  customWeights?: number[]
): number {
  if (chunks.length === 0) return 250;
  const weights =
    customWeights && customWeights.length === chunks.length
      ? customWeights
      : chunks.map((c) => computeChunkCognitiveWeight(c, mode));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
  const totalPassageMs =
    (Math.max(1, totalWords) / Math.max(60, activeWpm)) * 60000;
  const targetWeight = weights[chunkIndex] ?? weights[0];
  return Math.max(
    70,
    Math.round(totalPassageMs * (targetWeight / totalWeight))
  );
}
