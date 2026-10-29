import { QuizQuestion, TrainingPassage, PassageSourceType } from '../types/schema';

const DISCOURSE_REGEX =
  /\b(however|therefore|consequently|nevertheless|furthermore|moreover|in contrast|conversely|ultimately|instead|nonetheless|meanwhile|thus|hence)\b/i;

const SPLIT_BEFORE_WORDS = new Set([
  'in',
  'on',
  'at',
  'with',
  'from',
  'by',
  'for',
  'during',
  'without',
  'between',
  'through',
  'under',
  'into',
  'that',
  'which',
  'because',
  'although',
  'while',
  'whereas',
  'when',
  'whenever',
  'if',
  'unless',
  'however,',
  'therefore,',
  'consequently,',
  'nevertheless,',
  'furthermore,',
  'moreover,',
]);

/**
 * Rule-based greedy semantic chunker (2-4 words, <= 24 chars per chunk)
 */
export function splitIntoSemanticChunks(rawText: string): {
  chunks: string[];
  discourseMarkerIndices: number[];
} {
  const words = rawText
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      chunks.push(buffer.join(' '));
      buffer = [];
    }
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();
    const candidateLen =
      buffer.length === 0 ? word.length : buffer.join(' ').length + 1 + word.length;

    // Split before prepositions/conjunctions if buffer already has >= 2 words
    if (buffer.length >= 2 && SPLIT_BEFORE_WORDS.has(lower)) {
      flush();
    }

    // Flush if adding this word exceeds 4 words or 24 chars (when buffer has >= 2 words)
    if (buffer.length >= 4 || (buffer.length >= 2 && candidateLen > 24)) {
      flush();
    }

    buffer.push(word);

    // Flush after punctuation boundaries
    if (/[.!?,;:—]$/.test(word) && buffer.length >= 2) {
      flush();
    }
  }
  flush();

  const discourseMarkerIndices: number[] = [];
  chunks.forEach((chunk, idx) => {
    if (DISCOURSE_REGEX.test(chunk)) {
      discourseMarkerIndices.push(idx);
    }
  });

  return { chunks, discourseMarkerIndices };
}

/**
 * Heuristic Cloze / Context Comprehension Question Generator (Fallback & Question Pool Expander)
 */
export function generateHeuristicQuestions(
  title: string,
  rawText: string,
  maxQuestions = 8
): QuizQuestion[] {
  const sentences = rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6);

  const stopwordSet = new Set([
    'however',
    'because',
    'through',
    'between',
    'without',
    'another',
    'whether',
    'therefore',
    'furthermore',
    'consequently',
    'meanwhile',
    'nevertheless',
    'instead',
    'whereas',
    'although',
    'already',
    'several',
    'towards',
    'against',
  ]);

  // Extract content words (>= 6 letters, alphabetic)
  const contentWords = Array.from(
    new Set(
      (rawText.match(/\b[A-Za-z]{6,}\b/g) || []).map((w) => w.toLowerCase())
    )
  ).filter((w) => !stopwordSet.has(w));

  const fallbackPool = [
    'architecture',
    'synchronization',
    'distribution',
    'hypothesis',
    'transmission',
    'optimization',
    'integration',
    'plasticity',
    'equilibrium',
    'perception',
    'modulation',
    'trajectory',
  ];

  const questions: QuizQuestion[] = [];
  const usedTargets = new Set<string>();

  // Pass 1: One distinct Cloze target per sentence across all sentences
  // Pass 2: Second distinct Cloze target from multi-clause sentences if pool < maxQuestions
  for (let pass = 0; pass < 2 && questions.length < maxQuestions; pass++) {
    for (let sIdx = 0; sIdx < sentences.length && questions.length < maxQuestions; sIdx++) {
      const sentence = sentences[sIdx];
      const candidates = (sentence.match(/\b[A-Za-z]{6,}\b/g) || []).filter(
        (w) =>
          contentWords.includes(w.toLowerCase()) &&
          !usedTargets.has(w.toLowerCase())
      );

      const chosenRaw =
        candidates[0] ||
        (pass === 0
          ? sentence
              .split(/\s+/)
              .map((w) => w.replace(/[^A-Za-z]/g, ''))
              .find(
                (w) =>
                  w.length >= 5 &&
                  !stopwordSet.has(w.toLowerCase()) &&
                  !usedTargets.has(w.toLowerCase())
              )
          : undefined);

      if (!chosenRaw) continue;

      const cleanTarget = chosenRaw.replace(/[^A-Za-z]/g, '');
      const lowerTarget = cleanTarget.toLowerCase();
      usedTargets.add(lowerTarget);

      const blankedSentence = sentence.replace(
        new RegExp(`\\b${cleanTarget}\\b`),
        '[ ______ ]'
      );

      const isCapitalized = /^[A-Z]/.test(cleanTarget);
      const formatCase = (word: string) =>
        isCapitalized
          ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          : word.toLowerCase();

      const candidateDistractors = [...contentWords, ...fallbackPool].filter(
        (w) => w.toLowerCase() !== lowerTarget
      );

      const qIdx = questions.length;
      const distractors: string[] = [];
      for (let k = 0; k < candidateDistractors.length && distractors.length < 3; k++) {
        const pick =
          candidateDistractors[(qIdx * 3 + k) % candidateDistractors.length];
        const formatted = formatCase(pick);
        if (
          formatted.toLowerCase() !== lowerTarget &&
          !distractors.some((d) => d.toLowerCase() === formatted.toLowerCase())
        ) {
          distractors.push(formatted);
        }
      }

      while (distractors.length < 3) {
        distractors.push(formatCase(fallbackPool[distractors.length]));
      }

      const rawOptions = [cleanTarget, ...distractors.slice(0, 3)];
      const correctPos = qIdx % 4;
      const ordered: [string, string, string, string] = [
        rawOptions[0],
        rawOptions[1],
        rawOptions[2],
        rawOptions[3],
      ];
      const temp = ordered[correctPos];
      ordered[correctPos] = cleanTarget;
      ordered[0] = temp;

      questions.push({
        id: `q-auto-${sIdx}-${pass}-${qIdx}`,
        code: `CLOZE-0${qIdx + 1}`,
        question: `Which key term accurately completes this statement from "${title}":\n"${blankedSentence}"`,
        options: ordered,
        correctIndex: correctPos,
        explanation: `In the original passage context:\n"${sentence}"`,
      });
    }
  }

  while (questions.length < 3) {
    const extraWord =
      contentWords[questions.length + 2] ||
      fallbackPool[questions.length] ||
      'cognition';
    const extraDistractors = [...contentWords, ...fallbackPool]
      .filter((w) => w.toLowerCase() !== extraWord.toLowerCase())
      .slice(0, 3);
    questions.push({
      id: `q-auto-fallback-${questions.length}`,
      code: `SYNAPSE-0${questions.length + 1}`,
      question: `Which core concept is emphasized in "${title}"?`,
      options: [
        extraWord,
        extraDistractors[0] || 'entropy',
        extraDistractors[1] || 'latency',
        extraDistractors[2] || 'perception',
      ],
      correctIndex: 0,
      explanation: `The passage specifically emphasizes "${extraWord}" within "${title}".`,
    });
  }

  return questions;
}

export function buildNormalizedPassage(params: {
  title: string;
  rawText: string;
  category: string;
  sourceType: PassageSourceType;
  chunks?: string[];
  discourseMarkerIndices?: number[];
  questions?: QuizQuestion[];
}): TrainingPassage {
  const cleanText = params.rawText.replace(/\s+/g, ' ').trim();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const fallbackChunked = splitIntoSemanticChunks(cleanText);

  const chunks =
    params.chunks && params.chunks.length >= 2
      ? params.chunks
      : fallbackChunked.chunks;
  const discourseMarkerIndices =
    params.discourseMarkerIndices ?? fallbackChunked.discourseMarkerIndices;
  const questions =
    params.questions && params.questions.length > 0
      ? params.questions
      : generateHeuristicQuestions(params.title, cleanText);

  return {
    id: `${params.sourceType}-${Date.now()}`,
    sourceType: params.sourceType,
    title: params.title,
    category: params.category.toUpperCase(),
    wordCount,
    difficultyGrade: 11.5,
    rawText: cleanText,
    chunks,
    discourseMarkerIndices,
    questions,
    createdAt: Date.now(),
  };
}
