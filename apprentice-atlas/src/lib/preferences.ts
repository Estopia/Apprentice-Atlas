import AsyncStorage from '@react-native-async-storage/async-storage';

import { updateDiscoveryFilters } from './discovery-state';
import { setLocale } from './i18n';

export type UserPreferences = {
  onboardingComplete: boolean;
  audience: 'student' | 'dropout' | null;
  interests: string[];
  country: 'Germany' | 'United Kingdom' | null;
  locale: 'de' | 'en';
};

export type PreferencesSnapshot = {
  preferences: UserPreferences;
  isHydrated: boolean;
};

export const PREFERENCES_STORAGE_KEY = 'apprentice-atlas.preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
  onboardingComplete: false,
  audience: null,
  interests: [],
  country: null,
  locale: 'de',
};

let snapshot: PreferencesSnapshot = {
  preferences: DEFAULT_PREFERENCES,
  isHydrated: false,
};
const listeners = new Set<() => void>();

function isPreferences(value: unknown): value is UserPreferences {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<UserPreferences>;
  return (
    typeof candidate.onboardingComplete === 'boolean'
    && (candidate.audience === 'student' || candidate.audience === 'dropout' || candidate.audience === null)
    && Array.isArray(candidate.interests)
    && candidate.interests.every((interest) => typeof interest === 'string')
    && (candidate.country === 'Germany' || candidate.country === 'United Kingdom' || candidate.country === null)
    && (candidate.locale === 'de' || candidate.locale === 'en')
  );
}

function publish(preferences: UserPreferences) {
  snapshot = { preferences, isHydrated: true };
  listeners.forEach((listener) => listener());
}

function applyDiscoveryPersonalization(preferences: UserPreferences) {
  if (!preferences.onboardingComplete) return;
  updateDiscoveryFilters({
    country: preferences.country ?? undefined,
    category: preferences.interests.length === 1 ? preferences.interests[0] : undefined,
  });
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPreferencesSnapshot(): PreferencesSnapshot {
  return snapshot;
}

export async function loadPreferences(): Promise<UserPreferences> {
  let preferences = DEFAULT_PREFERENCES;
  try {
    const stored = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isPreferences(parsed)) preferences = parsed;
    }
  } catch {
    // First-run defaults keep anonymous discovery available if storage is unavailable.
  }
  publish(preferences);
  applyDiscoveryPersonalization(preferences);
  return preferences;
}

export async function savePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const safePreferences = isPreferences(preferences) ? preferences : DEFAULT_PREFERENCES;
  setLocale(safePreferences.locale);
  try {
    await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(safePreferences));
  } catch {
    // Keep the current session usable even when persistence is temporarily unavailable.
  }
  publish(safePreferences);
  return safePreferences;
}

export async function completeOnboarding(preferences: UserPreferences): Promise<UserPreferences> {
  const completed = await savePreferences({ ...preferences, onboardingComplete: true });
  applyDiscoveryPersonalization(completed);
  return completed;
}
