import Dexie, { Table } from 'dexie';
import {
  SessionLog,
  UserProfile,
  TrainingPassage,
  AchievementId,
  PassageProgress,
} from '../types/schema';

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  subtitle: string;
  description: string;
  badgeCode: string;
}

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  {
    id: 'NEURAL_CALIBRATED',
    title: 'NEURAL CALIBRATED',
    subtitle: 'Baseline Established',
    description:
      'Complete the self-paced baseline calibration to measure your natural reading velocity.',
    badgeCode: 'CAL-01',
  },
  {
    id: 'FIRST_SYNC',
    title: 'FIRST SYNAPSE',
    subtitle: 'First Quiz Verified',
    description:
      'Pass your first comprehension verification quiz (>=66% sync rate) on any training passage.',
    badgeCode: 'SYN-02',
  },
  {
    id: 'L2_FLUENCY_TIER',
    title: 'L2 FLUENCY TIER',
    subtitle: '180+ eWPM Verified',
    description:
      'Achieve 180+ Effective WPM with verified comprehension, entering the global L2 upper quartile.',
    badgeCode: 'L2F-03',
  },
  {
    id: 'NATIVE_HORIZON',
    title: 'NATIVE HORIZON',
    subtitle: '238+ eWPM on Unseen Text',
    description:
      'Pass a comprehension quiz at 238+ eWPM (L1 native adult average) on your very first attempt at a passage.',
    badgeCode: 'NAT-04',
  },
  {
    id: 'SUBVOCAL_BREAKER',
    title: 'SUBVOCAL BARRIER BROKEN',
    subtitle: '250+ eWPM Verified',
    description:
      'Pass a comprehension quiz with an effective reading speed of 250 eWPM or higher, surpassing vocal speech limits.',
    badgeCode: 'SVB-05',
  },
  {
    id: 'VELOCITY_300',
    title: 'CORTICAL OVERDRIVE',
    subtitle: '300+ eWPM Verified',
    description:
      'Reach 300+ Effective WPM with verified comprehension, entering the top 2% of global L2 readers.',
    badgeCode: 'VEL-06',
  },
  {
    id: 'HYPER_SACCADE',
    title: 'HYPER-SACCADE',
    subtitle: '350+ eWPM Elite',
    description:
      'Reach the elite 350+ eWPM visual intake tier with verified comprehension (top 1.5% L1 human tier).',
    badgeCode: 'HYP-07',
  },
  {
    id: 'APEX_400',
    title: 'CYBERNETIC APEX',
    subtitle: '400+ eWPM Apex',
    description:
      'Achieve 400+ Effective WPM with verified comprehension, reaching peak human visual intake velocity.',
    badgeCode: 'APX-08',
  },
  {
    id: 'PERFECT_SYNC',
    title: 'PERFECT SYNAPSE',
    subtitle: '100% Quiz Accuracy',
    description:
      'Score a flawless 100% comprehension sync rate on any training passage.',
    badgeCode: 'PRF-09',
  },
  {
    id: 'CRITICAL_REFLEX',
    title: 'ZERO REGRESSION FLOW',
    subtitle: '100% Flow + 100% Sync',
    description:
      'Complete a passage with zero backward regressions (100% Forward Flow) and 100% quiz accuracy.',
    badgeCode: 'FLW-10',
  },
  {
    id: 'FLASH_SNAPSHOT',
    title: 'RETINAL SNAPSHOT',
    subtitle: 'Tachistoscope 80%+ Sync',
    description:
      'Complete a Tachistoscope peripheral flash drill with at least 80% phrase recognition accuracy.',
    badgeCode: 'TCH-11',
  },
  {
    id: 'ORP_LOCKED',
    title: 'RETICLE LOCKED',
    subtitle: 'RSVP Stream 220+ eWPM',
    description:
      'Pass a center-reticle RSVP Stream session at 220+ Effective WPM.',
    badgeCode: 'RSV-12',
  },
  {
    id: 'TIME_COMPRESSOR',
    title: 'SYNTAX ARCHITECT',
    subtitle: 'ESL Structural Mode Clear',
    description:
      'Pass a comprehension quiz in Syntax Skimmer, Lexical Anchor, or Saccade Rail mode.',
    badgeCode: 'SYN-13',
  },
  {
    id: 'TRI_ENGINE_PILOT',
    title: 'OMNI-ENGINE PILOT',
    subtitle: '3+ Distinct Modes Verified',
    description:
      'Pass comprehension verification across at least 3 distinct training engines.',
    badgeCode: 'OMN-14',
  },
  {
    id: 'OVERCLOCK_MASTER',
    title: 'OVERCLOCK MASTER',
    subtitle: '3-Stage Passage Mastery',
    description:
      'Complete 3 verified mastery runs (★★★) on any single passage.',
    badgeCode: 'OVC-15',
  },
  {
    id: 'RENAISSANCE_SYNAPSE',
    title: 'RENAISSANCE SYNAPSE',
    subtitle: 'Cross-Domain Polymath',
    description:
      'Pass comprehension quizzes across 3 or more distinct passages in the corpus.',
    badgeCode: 'REN-16',
  },
  {
    id: 'LIVE_WIRE',
    title: 'LIVE WIRE UPLINK',
    subtitle: 'External Feed Verified',
    description:
      'Fetch and pass a live Wikipedia, Fine Arts, or Dev.to article (or custom text uplink).',
    badgeCode: 'NET-17',
  },
  {
    id: 'MARATHON_CORTEX',
    title: 'MARATHON CORTEX',
    subtitle: '5,000+ Words Processed',
    description:
      'Accumulate at least 5,000 total words read across your neural training log.',
    badgeCode: 'VOL-18',
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

    // Retroactively ensure any newly added achievements earned in past sessions are unlocked
    const unlocked = new Set<AchievementId>(
      existing.unlockedAchievements || []
    );
    if (existing.baselineWpm) unlocked.add('NEURAL_CALIBRATED');
    if (passedSessions.length >= 1) unlocked.add('FIRST_SYNC');
    if (verifiedBest >= 180) unlocked.add('L2_FLUENCY_TIER');
    if (verifiedBest >= 250) unlocked.add('SUBVOCAL_BREAKER');
    if (verifiedBest >= 300) unlocked.add('VELOCITY_300');
    if (verifiedBest >= 350) unlocked.add('HYPER_SACCADE');
    if (verifiedBest >= 400) unlocked.add('APEX_400');
    if (allSessions.some((s) => s.syncRate >= 0.99)) {
      unlocked.add('PERFECT_SYNC');
    }
    if (
      allSessions.some((s) => s.syncRate >= 0.99 && s.forwardFlowRate >= 0.995)
    ) {
      unlocked.add('CRITICAL_REFLEX');
    }
    if (
      allSessions.some((s) => s.mode === 'tachistoscope' && s.syncRate >= 0.8)
    ) {
      unlocked.add('FLASH_SNAPSHOT');
    }
    if (passedSessions.some((s) => s.mode === 'rsvp' && s.effectiveWpm >= 220)) {
      unlocked.add('ORP_LOCKED');
    }
    if (
      passedSessions.some(
        (s) =>
          s.mode === 'syntax_skimmer' ||
          s.mode === 'lexical_anchor' ||
          s.mode === 'saccade_rail'
      )
    ) {
      unlocked.add('TIME_COMPRESSOR');
    }
    const passedModes = new Set(passedSessions.map((s) => s.mode));
    if (passedModes.size >= 3) {
      unlocked.add('TRI_ENGINE_PILOT');
    }
    if (
      Object.values(existing.passageRecords || {}).some(
        (r) => r.stageCompleted >= 3
      )
    ) {
      unlocked.add('OVERCLOCK_MASTER');
    }
    if (new Set(passedSessions.map((s) => s.passageId)).size >= 3) {
      unlocked.add('RENAISSANCE_SYNAPSE');
    }
    if (
      passedSessions.some(
        (s) =>
          s.passageId.startsWith('wikipedia-') ||
          s.passageId.startsWith('devto-') ||
          s.passageId.startsWith('custom-')
      )
    ) {
      unlocked.add('LIVE_WIRE');
    }
    if (existing.totalWordsRead >= 5000) {
      unlocked.add('MARATHON_CORTEX');
    }

    const normalized: UserProfile = {
      ...existing,
      currentTargetWpm: migratedTargetWpm,
      bestEffectiveWpm: verifiedBest,
      unlockedAchievements: Array.from(unlocked),
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

export async function saveCalibrationBaseline(
  baselineWpm: number
): Promise<{
  profile: UserProfile;
  newlyUnlocked: AchievementId[];
}> {
  const clamped = Math.max(80, Math.min(600, Math.round(baselineWpm)));
  const profile = await getOrInitProfile();
  const unlocked = new Set<AchievementId>(profile.unlockedAchievements || []);
  const newlyUnlocked: AchievementId[] = [];

  if (!unlocked.has('NEURAL_CALIBRATED')) {
    unlocked.add('NEURAL_CALIBRATED');
    newlyUnlocked.push('NEURAL_CALIBRATED');
  }

  const updated: UserProfile = {
    ...profile,
    baselineWpm: clamped,
    currentTargetWpm: clamped,
    unlockedAchievements: Array.from(unlocked),
  };

  saveTargetWpmPreference(clamped);
  await db.profiles.put(updated);
  return { profile: updated, newlyUnlocked };
}

export async function recordSessionAndUpdateProfile(
  session: SessionLog,
  wordsRead: number,
  selectedTargetWpm: number,
  passageCategory?: string
): Promise<{
  profile: UserProfile;
  isNewOverallBest: boolean;
  isNewPassageBest: boolean;
  previousPassageBest: number;
  updatedPassageRecord: PassageProgress;
  newlyUnlocked: AchievementId[];
}> {
  await db.sessions.put(session);
  const profile = await getOrInitProfile();
  const today = new Date().toISOString().slice(0, 10);
  const quizPassed = session.syncRate >= QUIZ_PASS_THRESHOLD;

  const isCalibration = session.passageId === 'calibration-baseline-probe';
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
    !isCalibration &&
    quizPassed &&
    session.effectiveWpm > prevRecord.bestEffectiveWpm;
  const isNewOverallBest =
    !isCalibration &&
    quizPassed &&
    session.effectiveWpm > profile.bestEffectiveWpm;

  const nextStageCompleted: 0 | 1 | 2 | 3 = !isCalibration && quizPassed
    ? (Math.min(3, prevRecord.stageCompleted + 1) as 0 | 1 | 2 | 3)
    : prevRecord.stageCompleted;

  const updatedPassageRecord: PassageProgress = {
    passageId: session.passageId,
    bestEffectiveWpm:
      !isCalibration && quizPassed
        ? Math.max(prevRecord.bestEffectiveWpm, session.effectiveWpm)
        : prevRecord.bestEffectiveWpm,
    bestRawWpm:
      !isCalibration && quizPassed
        ? Math.max(prevRecord.bestRawWpm, session.rawWpm)
        : prevRecord.bestRawWpm,
    lastTargetWpm: selectedTargetWpm,
    stageCompleted: nextStageCompleted,
    attempts: prevRecord.attempts + 1,
    updatedAt: Date.now(),
  };

  if (!isCalibration) {
    records[session.passageId] = updatedPassageRecord;
  }

  // Evaluate Achievements
  const unlocked = new Set<AchievementId>(profile.unlockedAchievements || []);
  const newlyUnlocked: AchievementId[] = [];
  const grant = (id: AchievementId) => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  };

  const nextTotalWordsRead = profile.totalWordsRead + wordsRead;

  if (isCalibration) {
    grant('NEURAL_CALIBRATED');
  }
  if (!isCalibration && quizPassed) {
    grant('FIRST_SYNC');
  }
  if (quizPassed && session.effectiveWpm >= 180) {
    grant('L2_FLUENCY_TIER');
  }
  if (
    !isCalibration &&
    wasFirstAttemptOnPassage &&
    quizPassed &&
    session.effectiveWpm >= 238
  ) {
    grant('NATIVE_HORIZON');
  }
  if (quizPassed && session.effectiveWpm >= 250) {
    grant('SUBVOCAL_BREAKER');
  }
  if (quizPassed && session.effectiveWpm >= 300) {
    grant('VELOCITY_300');
  }
  if (quizPassed && session.effectiveWpm >= 350) {
    grant('HYPER_SACCADE');
  }
  if (quizPassed && session.effectiveWpm >= 400) {
    grant('APEX_400');
  }
  if (!isCalibration && session.syncRate >= 0.99) {
    grant('PERFECT_SYNC');
  }
  if (
    !isCalibration &&
    session.syncRate >= 0.99 &&
    session.forwardFlowRate >= 0.995
  ) {
    grant('CRITICAL_REFLEX');
  }
  if (session.mode === 'tachistoscope' && session.syncRate >= 0.8) {
    grant('FLASH_SNAPSHOT');
  }
  if (quizPassed && session.mode === 'rsvp' && session.effectiveWpm >= 220) {
    grant('ORP_LOCKED');
  }
  if (
    quizPassed &&
    (session.mode === 'syntax_skimmer' ||
      session.mode === 'lexical_anchor' ||
      session.mode === 'saccade_rail')
  ) {
    grant('TIME_COMPRESSOR');
  }
  if (!isCalibration && nextStageCompleted >= 3) {
    grant('OVERCLOCK_MASTER');
  }
  if (
    quizPassed &&
    (session.passageId.startsWith('wikipedia-') ||
      session.passageId.startsWith('devto-') ||
      session.passageId.startsWith('custom-') ||
      passageCategory === 'WIKIPEDIA' ||
      passageCategory === 'DEV_TO' ||
      passageCategory === 'CUSTOM')
  ) {
    grant('LIVE_WIRE');
  }
  if (nextTotalWordsRead >= 5000) {
    grant('MARATHON_CORTEX');
  }

  // Check multi-session achievements (RENAISSANCE_SYNAPSE & TRI_ENGINE_PILOT)
  if (
    quizPassed &&
    (!unlocked.has('RENAISSANCE_SYNAPSE') || !unlocked.has('TRI_ENGINE_PILOT'))
  ) {
    const allSessions = await db.sessions.toArray();
    const passedList = allSessions.filter(
      (s) => s.syncRate >= QUIZ_PASS_THRESHOLD
    );
    const passedIds = new Set(passedList.map((s) => s.passageId));
    if (passedIds.size >= 3) {
      grant('RENAISSANCE_SYNAPSE');
    }
    const passedModes = new Set(passedList.map((s) => s.mode));
    if (passedModes.size >= 3) {
      grant('TRI_ENGINE_PILOT');
    }
  }

  const updated: UserProfile = {
    ...profile,
    currentTargetWpm: selectedTargetWpm,
    bestEffectiveWpm:
      !isCalibration && quizPassed
        ? Math.max(profile.bestEffectiveWpm, session.effectiveWpm)
        : profile.bestEffectiveWpm,
    totalWordsRead: nextTotalWordsRead,
    lastActiveDate: today,
    unlockedAchievements: Array.from(unlocked),
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
