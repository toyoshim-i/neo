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
 * Heuristic Cloze / Context Comprehension Question Generator (Fallback when Local LLM is offline)
 */
export function generateHeuristicQuestions(
  title: string,
  rawText: string
): QuizQuestion[] {
  const sentences = rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 7);

  // Extract long content words (>= 7 letters, alphabetic)
  const contentWords = Array.from(
    new Set(
      (rawText.match(/\b[A-Za-z]{7,}\b/g) || []).map((w) => w.toLowerCase())
    )
  ).filter(
    (w) =>
      ![
        'however',
        'because',
        'through',
        'between',
        'without',
        'another',
        'whether',
        'therefore',
        'furthermore',
      ].includes(w)
  );

  const fallbackPool = [
    'architecture',
    'synchronization',
    'distribution',
    'hypothesis',
    'transmission',
    'optimization',
    'integration',
    'plasticity',
  ];

  const questions: QuizQuestion[] = [];
  const targetSentences = sentences.slice(0, 3);

  targetSentences.forEach((sentence, idx) => {
    const matchWord =
      sentence
        .match(/\b[A-Za-z]{7,}\b/g)
        ?.find((w) => contentWords.includes(w.toLowerCase())) ||
      sentence.split(/\s+/).find((w) => w.length >= 5)?.replace(/[^A-Za-z]/g, '') ||
      'concept';

    const cleanTarget = matchWord.replace(/[^A-Za-z]/g, '');
    const blankedSentence = sentence.replace(
      new RegExp(`\\b${cleanTarget}\\b`),
      '[ ______ ]'
    );

    const distractors = [...contentWords, ...fallbackPool]
      .filter((w) => w.toLowerCase() !== cleanTarget.toLowerCase())
      .slice(idx * 3, idx * 3 + 3);

    while (distractors.length < 3) {
      distractors.push(fallbackPool[distractors.length]);
    }

    const rawOptions = [cleanTarget, ...distractors.slice(0, 3)];
    const correctPos = idx % 4;
    // Rotate so correct answer lands at correctPos
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
      id: `q-auto-${Date.now()}-${idx}`,
      code: `SYNAPSE-0${idx + 1}`,
      question: `Which key term accurately completes this statement from "${title}": "${blankedSentence}"`,
      options: ordered,
      correctIndex: correctPos,
      explanation: `In the original passage context: "${sentence}"`,
    });
  });

  while (questions.length < 3) {
    questions.push({
      id: `q-auto-fallback-${questions.length}`,
      code: `BIO-EV-0${questions.length + 1}`,
      question: `What is the central subject discussed in "${title}"?`,
      options: [
        title,
        'Medieval agricultural taxation systems',
        'Submarine acoustic sonar calibration',
        'Atmospheric barometric pressure charts',
      ],
      correctIndex: 0,
      explanation: `The passage specifically focuses on "${title}".`,
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
