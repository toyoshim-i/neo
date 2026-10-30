import Dexie, { Table } from 'dexie';
import {
  SessionLog,
  UserProfile,
  TrainingPassage,
  AchievementId,
  PassageProgress,
} from '../types/schema';

export type AchievementCategory =
  | 'CADENCE'
  | 'ENGINES'
  | 'MASTERY'
  | 'VELOCITY';

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  subtitle: string;
  description: string;
  badgeCode: string;
  category: AchievementCategory;
}

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  // 1. CADENCE & VOLUME (Session count, active days, and cumulative words)
  {
    id: 'NEURAL_CALIBRATED',
    title: 'NEURAL CALIBRATED',
    subtitle: 'First Ghost Generated',
    description:
      'Complete your first reading run to measure your natural pace and generate your Ghost pacemaker.',
    badgeCode: 'CAL-01',
    category: 'CADENCE',
  },
  {
    id: 'FIRST_SYNC',
    title: 'FIRST SYNAPSE',
    subtitle: 'First Quiz Verified',
    description:
      'Pass your first comprehension verification quiz (>=66% sync rate) on any training passage.',
    badgeCode: 'SYN-02',
    category: 'CADENCE',
  },
  {
    id: 'SESSION_3',
    title: 'WARMUP SEQUENCE',
    subtitle: '3 Sessions Completed',
    description:
      'Complete 3 reading training sessions across any modes or passages.',
    badgeCode: 'RUN-03',
    category: 'CADENCE',
  },
  {
    id: 'SESSION_5',
    title: 'SYNAPTIC ROUTINE',
    subtitle: '5 Sessions Completed',
    description:
      'Complete 5 reading training sessions to establish a steady neural training habit.',
    badgeCode: 'RUN-04',
    category: 'CADENCE',
  },
  {
    id: 'SESSION_10',
    title: 'DECADE UPLINK',
    subtitle: '10 Sessions Completed',
    description:
      'Complete 10 reading training sessions in your neural telemetry log.',
    badgeCode: 'RUN-05',
    category: 'CADENCE',
  },
  {
    id: 'SESSION_25',
    title: 'QUARTER-CENTURY LINK',
    subtitle: '25 Sessions Completed',
    description:
      'Complete 25 reading training sessions across the training corpus.',
    badgeCode: 'RUN-06',
    category: 'CADENCE',
  },
  {
    id: 'SESSION_50',
    title: 'FIFTY-REP CORTEX',
    subtitle: '50 Sessions Completed',
    description:
      'Complete 50 reading training sessions, cementing high-speed visual processing.',
    badgeCode: 'RUN-07',
    category: 'CADENCE',
  },
  {
    id: 'SESSION_100',
    title: 'CENTURION OVERCLOCK',
    subtitle: '100 Sessions Completed',
    description:
      'Complete 100 reading training sessions—true dedication to L2 visual mastery.',
    badgeCode: 'RUN-08',
    category: 'CADENCE',
  },
  {
    id: 'STREAK_3',
    title: 'TRI-DAY PULSE',
    subtitle: '3+ Active Training Days',
    description:
      'Train across at least 3 distinct calendar days (or reach a 3-day streak).',
    badgeCode: 'STR-09',
    category: 'CADENCE',
  },
  {
    id: 'STREAK_7',
    title: 'HEPTA-CYCLE HABIT',
    subtitle: '7+ Active Training Days',
    description:
      'Train across at least 7 distinct calendar days (or reach a 7-day streak).',
    badgeCode: 'STR-10',
    category: 'CADENCE',
  },
  {
    id: 'WORDS_500',
    title: 'FIRST KILOBYTE',
    subtitle: '500+ Words Read',
    description:
      'Accumulate at least 500 total words read across your training sessions.',
    badgeCode: 'VOL-11',
    category: 'CADENCE',
  },
  {
    id: 'WORDS_1500',
    title: 'LEXICAL BUFFER',
    subtitle: '1,500+ Words Read',
    description:
      'Accumulate at least 1,500 total words read across your training sessions.',
    badgeCode: 'VOL-12',
    category: 'CADENCE',
  },
  {
    id: 'WORDS_3000',
    title: 'BROADBAND INTAKE',
    subtitle: '3,000+ Words Read',
    description:
      'Accumulate at least 3,000 total words read across your training sessions.',
    badgeCode: 'VOL-13',
    category: 'CADENCE',
  },
  {
    id: 'MARATHON_CORTEX',
    title: 'MARATHON CORTEX',
    subtitle: '5,000+ Words Read',
    description:
      'Accumulate at least 5,000 total words read across your neural training log.',
    badgeCode: 'VOL-14',
    category: 'CADENCE',
  },
  {
    id: 'WORDS_10000',
    title: 'TEN-KILOWORD ARCHIVE',
    subtitle: '10,000+ Words Read',
    description:
      'Accumulate at least 10,000 total words read across your neural training log.',
    badgeCode: 'VOL-15',
    category: 'CADENCE',
  },
  {
    id: 'WORDS_25000',
    title: 'GIGABIT READER',
    subtitle: '25,000+ Words Read',
    description:
      'Accumulate at least 25,000 total words read—equivalent to a full novella.',
    badgeCode: 'VOL-16',
    category: 'CADENCE',
  },

  // 2. 6 TRAINING ENGINES (Per-mode participation, repetition, and mastery)
  {
    id: 'CHUNK_PACER_INIT',
    title: 'CHUNK PACER ONLINE',
    subtitle: '1st Chunk Pacer Run',
    description:
      'Complete your first session in 01 // CHUNK PACER mode.',
    badgeCode: 'CHP-17',
    category: 'ENGINES',
  },
  {
    id: 'CHUNK_PACER_5',
    title: 'FLOW PACER VETERAN',
    subtitle: '5 Chunk Pacer Runs',
    description:
      'Complete 5 training sessions in 01 // CHUNK PACER mode.',
    badgeCode: 'CHP-18',
    category: 'ENGINES',
  },
  {
    id: 'CHUNK_PACER_ACE',
    title: 'ANTI-REGRESSION ACE',
    subtitle: 'Chunk Pacer 200+ eWPM',
    description:
      'Pass a comprehension quiz at 200+ Effective WPM in 01 // CHUNK PACER mode.',
    badgeCode: 'CHP-19',
    category: 'ENGINES',
  },
  {
    id: 'SYNTAX_SKIMMER_INIT',
    title: 'SKELETON SCANNER',
    subtitle: '1st Syntax Skimmer Run',
    description:
      'Complete your first session in 02 // SYNTAX SKIMMER mode.',
    badgeCode: 'SKM-20',
    category: 'ENGINES',
  },
  {
    id: 'SYNTAX_SKIMMER_5',
    title: 'GRAMMAR FILTER X5',
    subtitle: '5 Syntax Skimmer Runs',
    description:
      'Complete 5 training sessions in 02 // SYNTAX SKIMMER mode.',
    badgeCode: 'SKM-21',
    category: 'ENGINES',
  },
  {
    id: 'SYNTAX_SKIMMER_ACE',
    title: 'S-V-O EXTRACTOR',
    subtitle: 'Syntax Skimmer 200+ eWPM',
    description:
      'Pass a comprehension quiz at 200+ Effective WPM in 02 // SYNTAX SKIMMER mode.',
    badgeCode: 'SKM-22',
    category: 'ENGINES',
  },
  {
    id: 'LEXICAL_ANCHOR_INIT',
    title: 'PREFIX FIXATION',
    subtitle: '1st Lexical Anchor Run',
    description:
      'Complete your first session in 03 // LEXICAL ANCHOR mode.',
    badgeCode: 'LEX-23',
    category: 'ENGINES',
  },
  {
    id: 'LEXICAL_ANCHOR_5',
    title: 'ROOT PREDICTOR X5',
    subtitle: '5 Lexical Anchor Runs',
    description:
      'Complete 5 training sessions in 03 // LEXICAL ANCHOR mode.',
    badgeCode: 'LEX-24',
    category: 'ENGINES',
  },
  {
    id: 'LEXICAL_ANCHOR_ACE',
    title: 'PATTERN COMPLETER',
    subtitle: 'Lexical Anchor 200+ eWPM',
    description:
      'Pass a comprehension quiz at 200+ Effective WPM in 03 // LEXICAL ANCHOR mode.',
    badgeCode: 'LEX-25',
    category: 'ENGINES',
  },
  {
    id: 'SACCADE_RAIL_INIT',
    title: 'SPIRAL STEPPER',
    subtitle: '1st Saccade Rail Run',
    description:
      'Complete your first session in 04 // SACCADE RAIL (L-C-R staircase) mode.',
    badgeCode: 'SAC-26',
    category: 'ENGINES',
  },
  {
    id: 'SACCADE_RAIL_5',
    title: 'RHYTHMIC JUMPER X5',
    subtitle: '5 Saccade Rail Runs',
    description:
      'Complete 5 training sessions in 04 // SACCADE RAIL mode.',
    badgeCode: 'SAC-27',
    category: 'ENGINES',
  },
  {
    id: 'SACCADE_RAIL_ACE',
    title: 'BALLISTIC SACCADE ACE',
    subtitle: 'Saccade Rail 200+ eWPM',
    description:
      'Pass a comprehension quiz at 200+ Effective WPM in 04 // SACCADE RAIL mode.',
    badgeCode: 'SAC-28',
    category: 'ENGINES',
  },
  {
    id: 'RSVP_INIT',
    title: 'CENTER RETICLE ONLINE',
    subtitle: '1st RSVP Stream Run',
    description:
      'Complete your first session in 05 // RSVP STREAM mode.',
    badgeCode: 'RSV-29',
    category: 'ENGINES',
  },
  {
    id: 'RSVP_5',
    title: 'ZERO-SACCADE PILOT X5',
    subtitle: '5 RSVP Stream Runs',
    description:
      'Complete 5 training sessions in 05 // RSVP STREAM mode.',
    badgeCode: 'RSV-30',
    category: 'ENGINES',
  },
  {
    id: 'ORP_LOCKED',
    title: 'RETICLE LOCKED',
    subtitle: 'RSVP Stream 220+ eWPM',
    description:
      'Pass a center-reticle 05 // RSVP STREAM session at 220+ Effective WPM.',
    badgeCode: 'RSV-31',
    category: 'ENGINES',
  },
  {
    id: 'TACHISTOSCOPE_INIT',
    title: 'PERIPHERAL PROBE',
    subtitle: '1st Tachistoscope Run',
    description:
      'Complete your first session in 06 // TACHISTOSCOPE mode.',
    badgeCode: 'TCH-32',
    category: 'ENGINES',
  },
  {
    id: 'TACHISTOSCOPE_5',
    title: 'FLASH CORTEX X5',
    subtitle: '5 Tachistoscope Runs',
    description:
      'Complete 5 peripheral flash sessions in 06 // TACHISTOSCOPE mode.',
    badgeCode: 'TCH-33',
    category: 'ENGINES',
  },
  {
    id: 'FLASH_SNAPSHOT',
    title: 'RETINAL SNAPSHOT',
    subtitle: 'Tachistoscope 80%+ Sync',
    description:
      'Complete a 06 // TACHISTOSCOPE drill with at least 80% phrase recognition accuracy.',
    badgeCode: 'TCH-34',
    category: 'ENGINES',
  },
  {
    id: 'TIME_COMPRESSOR',
    title: 'SYNTAX ARCHITECT',
    subtitle: 'ESL Structural Mode Clear',
    description:
      'Pass a comprehension quiz in Syntax Skimmer, Lexical Anchor, or Saccade Rail mode.',
    badgeCode: 'ESL-35',
    category: 'ENGINES',
  },
  {
    id: 'TRI_ENGINE_PILOT',
    title: 'TRI-ENGINE PILOT',
    subtitle: '3+ Distinct Modes Verified',
    description:
      'Pass comprehension verification across at least 3 distinct training engines.',
    badgeCode: 'OMN-36',
    category: 'ENGINES',
  },
  {
    id: 'HEX_ENGINE_PILOT',
    title: 'HEX-ENGINE EXPLORER',
    subtitle: 'All 6 Modes Tried',
    description:
      'Complete at least 1 session in all 6 ESL training engines.',
    badgeCode: 'OMN-37',
    category: 'ENGINES',
  },
  {
    id: 'HEX_ENGINE_MASTER',
    title: 'OMNI-ENGINE GRANDMASTER',
    subtitle: 'All 6 Modes Verified',
    description:
      'Pass comprehension verification (>=66% sync) across all 6 ESL training engines.',
    badgeCode: 'OMN-38',
    category: 'ENGINES',
  },

  // 3. MASTERY, ACCURACY & CORPUS EXPLORATION
  {
    id: 'PERFECT_SYNC',
    title: 'PERFECT SYNAPSE',
    subtitle: '100% Quiz Accuracy',
    description:
      'Score a flawless 100% comprehension sync rate on any training passage.',
    badgeCode: 'PRF-39',
    category: 'MASTERY',
  },
  {
    id: 'PERFECT_SYNC_5',
    title: 'HIGH-PRECISION CORTEX',
    subtitle: '5x 100% Quiz Sessions',
    description:
      'Score 100% comprehension accuracy in 5 separate training sessions.',
    badgeCode: 'PRF-40',
    category: 'MASTERY',
  },
  {
    id: 'CRITICAL_REFLEX',
    title: 'ZERO REGRESSION FLOW',
    subtitle: '100% Flow + 100% Sync',
    description:
      'Complete a passage with zero backward regressions (100% Forward Flow) and 100% quiz accuracy.',
    badgeCode: 'FLW-41',
    category: 'MASTERY',
  },
  {
    id: 'RENAISSANCE_SYNAPSE',
    title: 'RENAISSANCE SYNAPSE',
    subtitle: '3+ Passages Verified',
    description:
      'Pass comprehension quizzes across 3 or more distinct passages in the corpus.',
    badgeCode: 'REN-42',
    category: 'MASTERY',
  },
  {
    id: 'CORPUS_EXPLORER_6',
    title: 'SCHOLAR OF THE MATRIX',
    subtitle: '6+ Passages Verified',
    description:
      'Pass comprehension quizzes across 6 or more distinct passages in the corpus.',
    badgeCode: 'REN-43',
    category: 'MASTERY',
  },
  {
    id: 'CORPUS_COMPLETIONIST_10',
    title: 'ARCHIVAL COMPLETIONIST',
    subtitle: '10+ Passages Verified',
    description:
      'Pass comprehension quizzes across 10 or more distinct passages.',
    badgeCode: 'REN-44',
    category: 'MASTERY',
  },
  {
    id: 'OVERCLOCK_MASTER',
    title: 'OVERCLOCK MASTER',
    subtitle: '3-Stage Passage Mastery',
    description:
      'Complete 3 verified mastery runs (★★★) on any single passage.',
    badgeCode: 'OVC-45',
    category: 'MASTERY',
  },
  {
    id: 'LIVE_WIRE',
    title: 'LIVE WIRE UPLINK',
    subtitle: 'External Feed Verified',
    description:
      'Fetch and pass a live Wikipedia, Fine Arts, or Dev.to article (or custom text uplink).',
    badgeCode: 'NET-46',
    category: 'MASTERY',
  },

  // 4. VELOCITY TIERS (Progressive speed milestones)
  {
    id: 'STEADY_160',
    title: 'CRUISING VELOCITY',
    subtitle: '160+ eWPM Verified',
    description:
      'Achieve 160+ Effective WPM with verified comprehension, surpassing conversational L2 pace.',
    badgeCode: 'VEL-47',
    category: 'VELOCITY',
  },
  {
    id: 'L2_FLUENCY_TIER',
    title: 'L2 FLUENCY TIER',
    subtitle: '180+ eWPM Verified',
    description:
      'Achieve 180+ Effective WPM with verified comprehension, entering the global L2 upper quartile.',
    badgeCode: 'L2F-48',
    category: 'VELOCITY',
  },
  {
    id: 'RAPID_210',
    title: 'RAPID INTAKE TIER',
    subtitle: '210+ eWPM Verified',
    description:
      'Achieve 210+ Effective WPM with verified comprehension, closing in on native reading speed.',
    badgeCode: 'VEL-49',
    category: 'VELOCITY',
  },
  {
    id: 'NATIVE_HORIZON',
    title: 'NATIVE HORIZON',
    subtitle: '238+ eWPM on Unseen Text',
    description:
      'Pass a comprehension quiz at 238+ eWPM (L1 native adult average) on your first attempt at a passage.',
    badgeCode: 'NAT-50',
    category: 'VELOCITY',
  },
  {
    id: 'SUBVOCAL_BREAKER',
    title: 'SUBVOCAL BARRIER BROKEN',
    subtitle: '250+ eWPM Verified',
    description:
      'Pass a comprehension quiz with an effective reading speed of 250 eWPM or higher, surpassing vocal speech limits.',
    badgeCode: 'SVB-51',
    category: 'VELOCITY',
  },
  {
    id: 'VELOCITY_300',
    title: 'CORTICAL OVERDRIVE',
    subtitle: '300+ eWPM Verified',
    description:
      'Reach 300+ Effective WPM with verified comprehension, entering the top 2% of global L2 readers.',
    badgeCode: 'VEL-52',
    category: 'VELOCITY',
  },
  {
    id: 'HYPER_SACCADE',
    title: 'HYPER-SACCADE',
    subtitle: '350+ eWPM Elite',
    description:
      'Reach the elite 350+ eWPM visual intake tier with verified comprehension (top 1.5% L1 human tier).',
    badgeCode: 'HYP-53',
    category: 'VELOCITY',
  },
  {
    id: 'APEX_400',
    title: 'CYBERNETIC APEX',
    subtitle: '400+ eWPM Apex',
    description:
      'Achieve 400+ Effective WPM with verified comprehension, reaching peak human visual intake velocity.',
    badgeCode: 'APX-54',
    category: 'VELOCITY',
  },
];

class WetwareDatabase extends Dexie {
  sessions!: Table<SessionLog, string>;
  profiles!: Table<UserProfile, string>;
  customPassages!: Table<TrainingPassage, string>;

  constructor() {
    super('WetwareNeuralOverclockDB');
    this.version(1).stores({
      sessions: 'id, timestamp, passageId, mode, effectiveWpm, synced',
      profiles: 'id',
      customPassages: 'id, sourceType, createdAt',
    });
  }
}

export const db = new WetwareDatabase();

export const INITIAL_DEFAULT_WPM = 150;
export const QUIZ_PASS_THRESHOLD = 0.66; // >= 2/3 correct answers required to pass quiz & update personal best
const LAST_WPM_STORAGE_KEY = 'wetware_last_target_wpm';

export function getSavedTargetWpm(): number {
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(LAST_WPM_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= 60 && parsed <= 900) {
      return Math.round(parsed);
    }
  }
  return INITIAL_DEFAULT_WPM;
}

export function saveTargetWpmPreference(wpm: number): void {
  const clamped = Math.max(60, Math.min(900, Math.round(wpm)));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_WPM_STORAGE_KEY, String(clamped));
  }
  void db.profiles.update('default', { currentTargetWpm: clamped }).catch(() => {
    // Ignore if profile row not created yet
  });
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  currentTargetWpm: getSavedTargetWpm(),
  bestEffectiveWpm: 0,
  totalWordsRead: 0,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  unlockedAchievements: [],
  passageRecords: {},
  llmEndpoint: 'http://localhost:11434',
  llmModel: 'gemma2:2b',
};

function evaluateAllAchievements(params: {
  existingUnlocked: AchievementId[];
  allSessions: SessionLog[];
  totalWordsRead: number;
  streakDays: number;
  baselineWpm?: number;
  passageRecords: Record<string, PassageProgress>;
  extraGrant?: (grant: (id: AchievementId) => void) => void;
}): {
  unlocked: AchievementId[];
  newlyUnlocked: AchievementId[];
} {
  const unlocked = new Set<AchievementId>(params.existingUnlocked);
  const newlyUnlocked: AchievementId[] = [];
  const grant = (id: AchievementId) => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  };

  const { allSessions, totalWordsRead, streakDays, baselineWpm, passageRecords } =
    params;
  const passedSessions = allSessions.filter(
    (s) => s.syncRate >= QUIZ_PASS_THRESHOLD
  );
  const verifiedBest = passedSessions.reduce(
    (max, s) => Math.max(max, s.effectiveWpm),
    0
  );

  // 1. CADENCE & VOLUME
  if (baselineWpm || allSessions.length >= 1) grant('NEURAL_CALIBRATED');
  if (passedSessions.length >= 1) grant('FIRST_SYNC');
  if (allSessions.length >= 3) grant('SESSION_3');
  if (allSessions.length >= 5) grant('SESSION_5');
  if (allSessions.length >= 10) grant('SESSION_10');
  if (allSessions.length >= 25) grant('SESSION_25');
  if (allSessions.length >= 50) grant('SESSION_50');
  if (allSessions.length >= 100) grant('SESSION_100');

  const distinctDays = new Set(
    allSessions.map((s) => new Date(s.timestamp).toISOString().slice(0, 10))
  ).size;
  const effectiveStreak = Math.max(streakDays, distinctDays);
  if (effectiveStreak >= 3) grant('STREAK_3');
  if (effectiveStreak >= 7) grant('STREAK_7');

  if (totalWordsRead >= 500) grant('WORDS_500');
  if (totalWordsRead >= 1500) grant('WORDS_1500');
  if (totalWordsRead >= 3000) grant('WORDS_3000');
  if (totalWordsRead >= 5000) grant('MARATHON_CORTEX');
  if (totalWordsRead >= 10000) grant('WORDS_10000');
  if (totalWordsRead >= 25000) grant('WORDS_25000');

  // 2. ENGINES (6 Training Modes)
  const countMode = (m: SessionLog['mode']) =>
    allSessions.filter((s) => s.mode === m).length;
  const hasModeAce = (m: SessionLog['mode'], minWpm = 200) =>
    passedSessions.some((s) => s.mode === m && s.effectiveWpm >= minWpm);

  if (countMode('chunk_pacer') >= 1) grant('CHUNK_PACER_INIT');
  if (countMode('chunk_pacer') >= 5) grant('CHUNK_PACER_5');
  if (hasModeAce('chunk_pacer', 200)) grant('CHUNK_PACER_ACE');

  if (countMode('syntax_skimmer') >= 1) grant('SYNTAX_SKIMMER_INIT');
  if (countMode('syntax_skimmer') >= 5) grant('SYNTAX_SKIMMER_5');
  if (hasModeAce('syntax_skimmer', 200)) grant('SYNTAX_SKIMMER_ACE');

  if (countMode('lexical_anchor') >= 1) grant('LEXICAL_ANCHOR_INIT');
  if (countMode('lexical_anchor') >= 5) grant('LEXICAL_ANCHOR_5');
  if (hasModeAce('lexical_anchor', 200)) grant('LEXICAL_ANCHOR_ACE');

  if (countMode('saccade_rail') >= 1) grant('SACCADE_RAIL_INIT');
  if (countMode('saccade_rail') >= 5) grant('SACCADE_RAIL_5');
  if (hasModeAce('saccade_rail', 200)) grant('SACCADE_RAIL_ACE');

  if (countMode('rsvp') >= 1) grant('RSVP_INIT');
  if (countMode('rsvp') >= 5) grant('RSVP_5');
  if (hasModeAce('rsvp', 220)) grant('ORP_LOCKED');

  if (countMode('tachistoscope') >= 1) grant('TACHISTOSCOPE_INIT');
  if (countMode('tachistoscope') >= 5) grant('TACHISTOSCOPE_5');
  if (allSessions.some((s) => s.mode === 'tachistoscope' && s.syncRate >= 0.8)) {
    grant('FLASH_SNAPSHOT');
  }

  if (
    passedSessions.some(
      (s) =>
        s.mode === 'syntax_skimmer' ||
        s.mode === 'lexical_anchor' ||
        s.mode === 'saccade_rail'
    )
  ) {
    grant('TIME_COMPRESSOR');
  }

  const allModesTried = new Set(allSessions.map((s) => s.mode));
  const passedModes = new Set(passedSessions.map((s) => s.mode));
  if (passedModes.size >= 3) grant('TRI_ENGINE_PILOT');
  if (allModesTried.size >= 6) grant('HEX_ENGINE_PILOT');
  if (passedModes.size >= 6) grant('HEX_ENGINE_MASTER');

  // 3. MASTERY & CORPUS
  const perfectSyncSessions = allSessions.filter((s) => s.syncRate >= 0.99);
  if (perfectSyncSessions.length >= 1) grant('PERFECT_SYNC');
  if (perfectSyncSessions.length >= 5) grant('PERFECT_SYNC_5');
  if (
    allSessions.some((s) => s.syncRate >= 0.99 && s.forwardFlowRate >= 0.995)
  ) {
    grant('CRITICAL_REFLEX');
  }

  const passedPassages = new Set(passedSessions.map((s) => s.passageId));
  if (passedPassages.size >= 3) grant('RENAISSANCE_SYNAPSE');
  if (passedPassages.size >= 6) grant('CORPUS_EXPLORER_6');
  if (passedPassages.size >= 10) grant('CORPUS_COMPLETIONIST_10');

  if (Object.values(passageRecords).some((r) => r.stageCompleted >= 3)) {
    grant('OVERCLOCK_MASTER');
  }
  if (
    passedSessions.some(
      (s) =>
        s.passageId.startsWith('wikipedia-') ||
        s.passageId.startsWith('devto-') ||
        s.passageId.startsWith('custom-')
    )
  ) {
    grant('LIVE_WIRE');
  }

  // 4. VELOCITY TIERS
  if (verifiedBest >= 160) grant('STEADY_160');
  if (verifiedBest >= 180) grant('L2_FLUENCY_TIER');
  if (verifiedBest >= 210) grant('RAPID_210');
  if (verifiedBest >= 250) grant('SUBVOCAL_BREAKER');
  if (verifiedBest >= 300) grant('VELOCITY_300');
  if (verifiedBest >= 350) grant('HYPER_SACCADE');
  if (verifiedBest >= 400) grant('APEX_400');

  if (params.extraGrant) {
    params.extraGrant(grant);
  }

  return {
    unlocked: Array.from(unlocked),
    newlyUnlocked,
  };
}

export async function getOrInitProfile(): Promise<UserProfile> {
  const [existing, allSessions] = await Promise.all([
    db.profiles.get('default'),
    db.sessions.toArray(),
  ]);

  // Recompute true personal best strictly from quiz-passed sessions (syncRate >= 0.66)
  const passedSessions = allSessions.filter(
    (s) => s.syncRate >= QUIZ_PASS_THRESHOLD
  );
  const verifiedBest = passedSessions.reduce(
    (max, s) => Math.max(max, s.effectiveWpm),
    0
  );

  if (existing) {
    const savedWpm =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(LAST_WPM_STORAGE_KEY)
        : null;
    const migratedTargetWpm = savedWpm
      ? getSavedTargetWpm()
      : existing.totalWordsRead === 0 && existing.currentTargetWpm === 260
      ? INITIAL_DEFAULT_WPM
      : existing.currentTargetWpm || INITIAL_DEFAULT_WPM;

    const { unlocked } = evaluateAllAchievements({
      existingUnlocked: existing.unlockedAchievements || [],
      allSessions,
      totalWordsRead: existing.totalWordsRead,
      streakDays: existing.streakDays || 1,
      baselineWpm: existing.baselineWpm,
      passageRecords: existing.passageRecords || {},
    });

    const normalized: UserProfile = {
      ...existing,
      currentTargetWpm: migratedTargetWpm,
      bestEffectiveWpm: verifiedBest,
      unlockedAchievements: unlocked,
      passageRecords: existing.passageRecords || {},
    };
    await db.profiles.put(normalized);
    if (typeof window !== 'undefined' && !savedWpm) {
      window.localStorage.setItem(
        LAST_WPM_STORAGE_KEY,
        String(migratedTargetWpm)
      );
    }
    return normalized;
  }

  await db.profiles.put(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

export async function recordSessionAndUpdateProfile(
  session: SessionLog,
  wordsRead: number,
  selectedTargetWpm: number,
  passageCategory?: string,
  candidateGhostWeights?: number[]
): Promise<{
  profile: UserProfile;
  isNewOverallBest: boolean;
  isNewPassageBest: boolean;
  previousPassageBest: number;
  updatedPassageRecord: PassageProgress;
  newlyUnlocked: AchievementId[];
}> {
  const profile = await getOrInitProfile();
  await db.sessions.put(session);
  const allSessions = await db.sessions.toArray();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const quizPassed = session.syncRate >= QUIZ_PASS_THRESHOLD;

  const records: Record<string, PassageProgress> = {
    ...(profile.passageRecords || {}),
  };

  const prevRecord: PassageProgress = records[session.passageId] || {
    passageId: session.passageId,
    bestEffectiveWpm: 0,
    bestRawWpm: 0,
    lastTargetWpm: selectedTargetWpm,
    stageCompleted: 0,
    attempts: 0,
    updatedAt: Date.now(),
  };

  const wasFirstAttemptOnPassage = prevRecord.attempts === 0;
  const previousPassageBest = prevRecord.bestEffectiveWpm;
  const isNewPassageBest =
    quizPassed && session.effectiveWpm > prevRecord.bestEffectiveWpm;
  const isNewOverallBest =
    quizPassed && session.effectiveWpm > profile.bestEffectiveWpm;

  const nextStageCompleted: 0 | 1 | 2 | 3 = quizPassed
    ? (Math.min(3, prevRecord.stageCompleted + 1) as 0 | 1 | 2 | 3)
    : prevRecord.stageCompleted;

  const updatedPassageRecord: PassageProgress = {
    passageId: session.passageId,
    bestEffectiveWpm: quizPassed
      ? Math.max(prevRecord.bestEffectiveWpm, session.effectiveWpm)
      : prevRecord.bestEffectiveWpm,
    bestRawWpm: quizPassed
      ? Math.max(prevRecord.bestRawWpm, session.rawWpm)
      : prevRecord.bestRawWpm,
    lastTargetWpm: selectedTargetWpm,
    stageCompleted: nextStageCompleted,
    attempts: prevRecord.attempts + 1,
    updatedAt: Date.now(),
    bestChunkWeights:
      (isNewPassageBest || !prevRecord.bestChunkWeights) &&
      candidateGhostWeights &&
      candidateGhostWeights.length > 0
        ? candidateGhostWeights
        : prevRecord.bestChunkWeights,
  };

  records[session.passageId] = updatedPassageRecord;

  const nextTotalWordsRead = profile.totalWordsRead + wordsRead;
  const nextBaselineWpm =
    profile.baselineWpm ||
    Math.max(80, Math.min(600, Math.round(session.rawWpm)));
  const nextStreakDays =
    profile.lastActiveDate === today
      ? profile.streakDays || 1
      : profile.lastActiveDate === yesterday
      ? (profile.streakDays || 1) + 1
      : 1;

  const { unlocked, newlyUnlocked } = evaluateAllAchievements({
    existingUnlocked: profile.unlockedAchievements || [],
    allSessions,
    totalWordsRead: nextTotalWordsRead,
    streakDays: nextStreakDays,
    baselineWpm: nextBaselineWpm,
    passageRecords: records,
    extraGrant: (grant) => {
      if (
        wasFirstAttemptOnPassage &&
        quizPassed &&
        session.effectiveWpm >= 238
      ) {
        grant('NATIVE_HORIZON');
      }
      if (
        quizPassed &&
        (passageCategory === 'WIKIPEDIA' ||
          passageCategory === 'DEV_TO' ||
          passageCategory === 'CUSTOM')
      ) {
        grant('LIVE_WIRE');
      }
    },
  });

  const updated: UserProfile = {
    ...profile,
    baselineWpm: nextBaselineWpm,
    currentTargetWpm: selectedTargetWpm,
    bestEffectiveWpm: quizPassed
      ? Math.max(profile.bestEffectiveWpm, session.effectiveWpm)
      : profile.bestEffectiveWpm,
    totalWordsRead: nextTotalWordsRead,
    streakDays: nextStreakDays,
    lastActiveDate: today,
    unlockedAchievements: unlocked,
    passageRecords: records,
  };

  await db.profiles.put(updated);
  return {
    profile: updated,
    isNewOverallBest,
    isNewPassageBest,
    previousPassageBest,
    updatedPassageRecord,
    newlyUnlocked,
  };
}

export async function exportDatabaseJson(): Promise<string> {
  const [sessions, profiles, customPassages] = await Promise.all([
    db.sessions.toArray(),
    db.profiles.toArray(),
    db.customPassages.toArray(),
  ]);
  return JSON.stringify({ sessions, profiles, customPassages }, null, 2);
}

export async function importDatabaseJson(rawJson: string): Promise<void> {
  const data = JSON.parse(rawJson);
  if (Array.isArray(data.sessions)) {
    await db.sessions.bulkPut(data.sessions);
  }
  if (Array.isArray(data.profiles)) {
    await db.profiles.bulkPut(data.profiles);
  }
  if (Array.isArray(data.customPassages)) {
    await db.customPassages.bulkPut(data.customPassages);
  }
}
