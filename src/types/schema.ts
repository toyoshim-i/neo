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
  | 'syntax_skimmer'
  | 'lexical_anchor'
  | 'saccade_rail'
  | 'rsvp'
  | 'tachistoscope';

export type AchievementId =
  | 'NEURAL_CALIBRATED'
  | 'FIRST_SYNC'
  | 'SESSION_3'
  | 'SESSION_5'
  | 'SESSION_10'
  | 'SESSION_25'
  | 'SESSION_50'
  | 'SESSION_100'
  | 'STREAK_3'
  | 'STREAK_7'
  | 'WORDS_500'
  | 'WORDS_1500'
  | 'WORDS_3000'
  | 'MARATHON_CORTEX'
  | 'WORDS_10000'
  | 'WORDS_25000'
  | 'CHUNK_PACER_INIT'
  | 'CHUNK_PACER_5'
  | 'CHUNK_PACER_ACE'
  | 'SYNTAX_SKIMMER_INIT'
  | 'SYNTAX_SKIMMER_5'
  | 'SYNTAX_SKIMMER_ACE'
  | 'LEXICAL_ANCHOR_INIT'
  | 'LEXICAL_ANCHOR_5'
  | 'LEXICAL_ANCHOR_ACE'
  | 'SACCADE_RAIL_INIT'
  | 'SACCADE_RAIL_5'
  | 'SACCADE_RAIL_ACE'
  | 'RSVP_INIT'
  | 'RSVP_5'
  | 'ORP_LOCKED'
  | 'TACHISTOSCOPE_INIT'
  | 'TACHISTOSCOPE_5'
  | 'FLASH_SNAPSHOT'
  | 'TIME_COMPRESSOR'
  | 'TRI_ENGINE_PILOT'
  | 'HEX_ENGINE_PILOT'
  | 'HEX_ENGINE_MASTER'
  | 'PERFECT_SYNC'
  | 'PERFECT_SYNC_5'
  | 'CRITICAL_REFLEX'
  | 'RENAISSANCE_SYNAPSE'
  | 'CORPUS_EXPLORER_6'
  | 'CORPUS_COMPLETIONIST_10'
  | 'OVERCLOCK_MASTER'
  | 'LIVE_WIRE'
  | 'STEADY_160'
  | 'L2_FLUENCY_TIER'
  | 'RAPID_210'
  | 'NATIVE_HORIZON'
  | 'SUBVOCAL_BREAKER'
  | 'VELOCITY_300'
  | 'HYPER_SACCADE'
  | 'APEX_400';

export interface PassageProgress {
  passageId: string;
  bestEffectiveWpm: number;
  bestRawWpm: number;
  lastTargetWpm: number;
  stageCompleted: 0 | 1 | 2 | 3; // 0=Unread, 1=Stage1(Chunk), 2=Stage2(Pacer), 3=Mastered(Overclock)
  attempts: number;
  updatedAt: number;
  bestChunkWeights?: number[]; // Smoothed PB timing weights (blended 50/50 with ideal cognitive curve)
}

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
  baselineWpm?: number;    // Initial self-paced calibration WPM
  currentTargetWpm: number;
  bestEffectiveWpm: number;
  totalWordsRead: number;
  streakDays: number;
  lastActiveDate: string;  // YYYY-MM-DD
  unlockedAchievements?: AchievementId[];
  passageRecords?: Record<string, PassageProgress>;
  llmEndpoint: string;     // e.g., "http://localhost:11434"
  llmModel: string;        // e.g., "gemma2:2b"
  syncEndpoint?: string;   // Optional remote sync URL
  syncApiKey?: string;
}
