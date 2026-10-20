export type PassageSourceType =
  | 'preset'
  | 'wikipedia'
  | 'hackernews'
  | 'devto'
  | 'arxiv'
  | 'rss'
  | 'custom';

export type TrainingMode =
  | 'chunk_pacer'
  | 'rsvp'
  | 'overclock_432'
  | 'tachistoscope';

export interface QuizQuestion {
  id: string;
  code: string;           // e.g., "BIO-EV-01", "SYNAPSE-02"
  question: string;       // Question text
  options: [string, string, string, string]; // 4 choices
  correctIndex: number;   // 0 to 3
  explanation: string;    // Explanation why the answer is correct
}

export interface TrainingPassage {
  id: string;
  sourceType: PassageSourceType;
  title: string;
  category: string;       // e.g., "NEUROSCIENCE", "SYSTEM_ARCH", "QUANTUM_PHYS"
  wordCount: number;
  difficultyGrade: number;// Flesch-Kincaid Grade equivalent (8.0 ~ 16.0)
  rawText: string;
  chunks: string[];       // Split into meaningful semantic chunks (2~4 words)
  discourseMarkerIndices: number[]; // Indices in chunks[] containing contrast/conclusion markers
  questions: QuizQuestion[];        // Comprehension quiz (typically 3 questions)
  createdAt: number;
}

export interface SessionLog {
  id: string;              // UUID v4
  timestamp: number;       // Unix epoch ms
  passageId: string;
  mode: TrainingMode;
  rawWpm: number;          // Raw reading speed
  syncRate: number;        // Quiz accuracy (0.0 ~ 1.0)
  effectiveWpm: number;    // rawWpm * syncRate
  fixationMs: number;      // Average fixation duration per chunk (ms)
  perceptualSpan: number;  // Average words per chunk processed
  forwardFlowRate: number; // Ratio of forward saccades without regression (0.0 ~ 1.0)
  synced: 0 | 1;           // Cloud sync status flag
}

export interface UserProfile {
  id: 'default';
  currentTargetWpm: number;
  bestEffectiveWpm: number;
  totalWordsRead: number;
  streakDays: number;
  lastActiveDate: string;  // YYYY-MM-DD
  llmEndpoint: string;     // e.g., "http://localhost:11434"
  llmModel: string;        // e.g., "gemma2:2b"
  syncEndpoint?: string;   // Optional remote sync URL
  syncApiKey?: string;
}
