import AsyncStorage from '@react-native-async-storage/async-storage';

export const CAREER_PROFILE_MAX_LENGTH = 2000;

type CareerProfileStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export type IdentityScopedPreparationState<Result> = {
  userId: string | null;
  background: string;
  result: Result | null;
  error: string | null;
  saveError: boolean;
  generating: boolean;
};

export function getIdentityScopedPreparationState<Result>(
  state: IdentityScopedPreparationState<Result> | null,
  userId: string | null,
): IdentityScopedPreparationState<Result> {
  if (state?.userId === userId) return state;
  return { userId, background: '', result: null, error: null, saveError: false, generating: false };
}

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
