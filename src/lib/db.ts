import Dexie, { Table } from 'dexie';
import { SessionLog, UserProfile, TrainingPassage } from '../types/schema';

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
  selectedTargetWpm: number
): Promise<UserProfile> {
  await db.sessions.put(session);
  const profile = await getOrInitProfile();
  const today = new Date().toISOString().slice(0, 10);
  const quizPassed = session.syncRate >= QUIZ_PASS_THRESHOLD;

  const updated: UserProfile = {
    ...profile,
    currentTargetWpm: selectedTargetWpm,
    bestEffectiveWpm: quizPassed
      ? Math.max(profile.bestEffectiveWpm, session.effectiveWpm)
      : profile.bestEffectiveWpm,
    totalWordsRead: profile.totalWordsRead + wordsRead,
    lastActiveDate: today,
  };

  await db.profiles.put(updated);
  return updated;
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
