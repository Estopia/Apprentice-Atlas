import AsyncStorage from '@react-native-async-storage/async-storage';

export const CAREER_PROFILE_MAX_LENGTH = 2000;

type CareerProfileStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

const profileKey = (userId: string) => `apprentice-atlas:career-profile:${userId}`;

export async function loadCareerProfile(userId: string, storage: CareerProfileStorage = AsyncStorage): Promise<string> {
  if (!userId) return '';
  try {
    const stored = await storage.getItem(profileKey(userId));
    return typeof stored === 'string' && stored.length <= CAREER_PROFILE_MAX_LENGTH ? stored.trim() : '';
  } catch {
    return '';
  }
}

export async function saveCareerProfile(userId: string, background: string, storage: CareerProfileStorage = AsyncStorage): Promise<void> {
  if (!userId) return;
  const normalized = background.trim();
  if (normalized.length > CAREER_PROFILE_MAX_LENGTH) throw new Error('Career profile is too long.');
  await storage.setItem(profileKey(userId), normalized);
}
