import { QuizQuestion, TrainingMode } from '../types/schema';

export type ScreenState =
  | 'title'
  | 'calibration'
  | 'home'
  | 'preview'
  | 'reading'
  | 'quiz'
  | 'result';

export type AppExperienceMode = 'guided' | 'freeplay';
export type PassageModalTab = 'presets' | 'live' | 'custom';

export const MODE_INFO: Record<
  TrainingMode,
  { label: string; shortDesc: string }
> = {
  chunk_pacer: {
    label: 'CHUNK PACER',
    shortDesc:
      'Full paragraph view with auto-advancing 2–4 word semantic highlights.',
  },
  rsvp: {
    label: 'RSVP STREAM',
    shortDesc:
      'Lock your gaze at the center ORP reticle as chunks flash sequentially.',
  },
  overclock_432: {
    label: '4/3/2 OVERCLOCK',
    shortDesc:
      'Read the same passage across 3 passes at 100% → 75% → 50% time compression.',
  },
  tachistoscope: {
    label: 'TACHISTOSCOPE',
    shortDesc:
      'Flash 3–4 word phrases for ~170ms to train parallel parafoveal recognition.',
  },
};

export function shuffleQuizQuestions(
  questions: QuizQuestion[]
): QuizQuestion[] {
  return questions.map((q) => {
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
 * Computes the exact millisecond duration for `chunkIndex` such that:
 * 1. Every chunk's duration is proportional to its character/lexical cognitive weight.
 * 2. The sum of all chunk durations across the passage equals the exact total time for `activeWpm`.
 */
export function computeChunkDurationMs(
  chunks: string[],
  chunkIndex: number,
  totalWords: number,
  activeWpm: number,
  mode: TrainingMode
): number {
  if (chunks.length === 0) return 250;
  const weights = chunks.map((c) => computeChunkCognitiveWeight(c, mode));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;
  const totalPassageMs =
    (Math.max(1, totalWords) / Math.max(60, activeWpm)) * 60000;
  const targetWeight = weights[chunkIndex] ?? weights[0];
  return Math.max(
    70,
    Math.round(totalPassageMs * (targetWeight / totalWeight))
  );
}
