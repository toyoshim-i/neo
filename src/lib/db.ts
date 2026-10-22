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
      'Complete the self-paced baseline calibration to measure your natural reading speed.',
    badgeCode: 'CAL-01',
  },
  {
    id: 'SUBVOCAL_BREAKER',
    title: 'SUBVOCAL BARRIER BROKEN',
    subtitle: '250+ eWPM Verified',
    description:
      'Pass a comprehension quiz with an effective reading speed of 250 eWPM or higher, surpassing vocal speech limits.',
    badgeCode: 'SVB-02',
  },
  {
    id: 'NATIVE_HORIZON',
    title: 'NATIVE HORIZON',
    subtitle: '238+ eWPM on Unseen Text',
    description:
      'Pass a comprehension quiz at 238+ eWPM on your very first attempt on a new passage.',
    badgeCode: 'NAT-03',
  },
  {
    id: 'OVERCLOCK_MASTER',
    title: 'OVERCLOCK MASTER',
    subtitle: '3-Stage Passage Mastery',
    description:
      'Complete all 3 guided training stages (Chunk -> Pacer -> Overclock) on any passage.',
    badgeCode: 'OVC-04',
  },
  {
    id: 'RENAISSANCE_SYNAPSE',
    title: 'RENAISSANCE SYNAPSE',
    subtitle: 'Cross-Domain Polymath',
    description:
      'Pass comprehension quizzes across 3 or more distinct subject categories (e.g., Science, Tech, Arts).',
    badgeCode: 'REN-05',
  },
  {
    id: 'HYPER_SACCADE',
    title: 'HYPER-SACCADE',
    subtitle: '350+ eWPM Elite',
    description:
      'Reach the elite 350+ eWPM visual intake tier with verified comprehension.',
    badgeCode: 'HYP-06',
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
  const verifiedBest = allSessions
    .filter((s) => s.syncRate >= QUIZ_PASS_THRESHOLD)
    .reduce((max, s) => Math.max(max, s.effectiveWpm), 0);

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

    const normalized: UserProfile = {
      ...existing,
      currentTargetWpm: migratedTargetWpm,
      bestEffectiveWpm: verifiedBest,
      unlockedAchievements: existing.unlockedAchievements || [],
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

  if (isCalibration) {
    grant('NEURAL_CALIBRATED');
  }
  if (quizPassed && session.effectiveWpm >= 250) {
    grant('SUBVOCAL_BREAKER');
  }
  if (
    !isCalibration &&
    wasFirstAttemptOnPassage &&
    quizPassed &&
    session.effectiveWpm >= 238
  ) {
    grant('NATIVE_HORIZON');
  }
  if (!isCalibration && nextStageCompleted >= 3) {
    grant('OVERCLOCK_MASTER');
  }
  if (quizPassed && session.effectiveWpm >= 350) {
    grant('HYPER_SACCADE');
  }

  // Check cross-domain categories (RENAISSANCE_SYNAPSE)
  if (quizPassed && !unlocked.has('RENAISSANCE_SYNAPSE')) {
    const allSessions = await db.sessions.toArray();
    const passedIds = new Set(
      allSessions
        .filter((s) => s.syncRate >= QUIZ_PASS_THRESHOLD)
        .map((s) => s.passageId)
    );
    if (passedIds.size >= 3 || (passageCategory && passedIds.size >= 3)) {
      grant('RENAISSANCE_SYNAPSE');
    }
  }

  const updated: UserProfile = {
    ...profile,
    currentTargetWpm: selectedTargetWpm,
    bestEffectiveWpm:
      !isCalibration && quizPassed
        ? Math.max(profile.bestEffectiveWpm, session.effectiveWpm)
        : profile.bestEffectiveWpm,
    totalWordsRead: profile.totalWordsRead + wordsRead,
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
