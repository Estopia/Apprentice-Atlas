import AsyncStorage from '@react-native-async-storage/async-storage';

export const CAREER_PROFILE_MAX_LENGTH = 2000;

type CareerProfileStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export type PreparationScope = {
  userId: string | null;
  jobId: string;
  locale: string;
  scopeId?: object;
};

export type IdentityScopedPreparationState<Result> = PreparationScope & {
  background: string;
  result: Result | null;
  error: string | null;
  saveError: boolean;
  generating: boolean;
};

export function getPreparationScopedState<Result>(
  state: IdentityScopedPreparationState<Result> | null,
  scope: PreparationScope,
): IdentityScopedPreparationState<Result> {
  if (!state || state.userId !== scope.userId) {
    return { ...scope, background: '', result: null, error: null, saveError: false, generating: false };
  }
  if (state.jobId !== scope.jobId || state.locale !== scope.locale || state.scopeId !== scope.scopeId) {
    return { ...state, ...scope, result: null, error: null, generating: false };
  }
  return state;
}

export type PreparationRequestSnapshot = PreparationScope & {
  requestId: number;
  background: string;
};

export function isPreparationRequestCurrent(
  request: PreparationRequestSnapshot,
  current: PreparationRequestSnapshot | null,
): boolean {
  return current !== null
    && request.requestId === current.requestId
    && request.userId === current.userId
    && request.jobId === current.jobId
    && request.locale === current.locale
    && request.scopeId === current.scopeId
    && request.background === current.background;
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

export async function deleteCareerProfile(userId: string, storage: CareerProfileStorage = AsyncStorage): Promise<void> {
  if (!userId) return;
  await storage.removeItem(profileKey(userId));
}
