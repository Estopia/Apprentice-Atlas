import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { storage.set(key, value); },
  },
}));

import { getDiscoveryState, resetDiscoveryState, setDiscoveryFilters } from '../src/lib/discovery-state';
import {
  completeOnboarding,
  DEFAULT_PREFERENCES,
  loadPreferences,
  PREFERENCES_STORAGE_KEY,
  savePreferences,
  type UserPreferences,
} from '../src/lib/preferences';

const personalizedPreferences: UserPreferences = {
  onboardingComplete: false,
  audience: 'student',
  interests: ['technology', 'business'],
  country: 'Germany',
  locale: 'en',
};

describe('anonymous preferences', () => {
  beforeEach(() => {
    storage.clear();
    resetDiscoveryState();
  });

  it('falls back safely when stored preferences are malformed', async () => {
    storage.set(PREFERENCES_STORAGE_KEY, '{not-json');

    await expect(loadPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back safely when stored preference fields are invalid', async () => {
    storage.set(PREFERENCES_STORAGE_KEY, JSON.stringify({
      onboardingComplete: 'yes',
      audience: 'manager',
      interests: [42],
      country: 'France',
      locale: 'fr',
    }));

    await expect(loadPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips saved preferences through AsyncStorage', async () => {
    await savePreferences(personalizedPreferences);

    expect(JSON.parse(storage.get(PREFERENCES_STORAGE_KEY) ?? '')).toEqual(personalizedPreferences);
    await expect(loadPreferences()).resolves.toEqual(personalizedPreferences);
  });

  it('completes onboarding and applies country plus the first interest to discovery', async () => {
    setDiscoveryFilters({ search: 'apprentice', radiusKm: 25 });

    const completed = await completeOnboarding(personalizedPreferences);

    expect(completed).toEqual({ ...personalizedPreferences, onboardingComplete: true });
    expect(getDiscoveryState().filters).toEqual({
      search: 'apprentice',
      radiusKm: 25,
      country: 'Germany',
      category: 'technology',
    });
    await expect(loadPreferences()).resolves.toEqual(completed);
  });
});
