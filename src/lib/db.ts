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

export const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  currentTargetWpm: 260,
  bestEffectiveWpm: 260,
  totalWordsRead: 0,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  llmEndpoint: 'http://localhost:11434',
  llmModel: 'gemma2:2b',
};

export async function getOrInitProfile(): Promise<UserProfile> {
  const existing = await db.profiles.get('default');
  if (existing) return existing;
  await db.profiles.put(DEFAULT_PROFILE);
  return DEFAULT_PROFILE;
}

export async function recordSessionAndUpdateProfile(
  session: SessionLog,
  wordsRead: number,
  nextTargetWpm: number
): Promise<UserProfile> {
  await db.sessions.put(session);
  const profile = await getOrInitProfile();
  const today = new Date().toISOString().slice(0, 10);

  const updated: UserProfile = {
    ...profile,
    currentTargetWpm: nextTargetWpm,
    bestEffectiveWpm: Math.max(profile.bestEffectiveWpm, session.effectiveWpm),
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
