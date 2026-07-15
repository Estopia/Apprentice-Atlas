import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
let deviceLocales: { languageCode: string; regionCode: string }[] = [{ languageCode: 'de', regionCode: 'DE' }];

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { storage.set(key, value); },
  },
}));
vi.mock('expo-localization', () => ({
  getLocales: () => deviceLocales,
}));

import { getDiscoveryState, resetDiscoveryState, setDiscoveryFilters } from '../src/lib/discovery-state';
import { getLocale, setLocale } from '../src/lib/i18n';
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
    deviceLocales = [{ languageCode: 'de', regionCode: 'DE' }];
    resetDiscoveryState();
    setLocale('de');
  });

  it('uses device language and region only when no preferences exist yet', async () => {
    deviceLocales = [{ languageCode: 'en', regionCode: 'GB' }];

    await expect(loadPreferences()).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      locale: 'en',
      country: 'United Kingdom',
    });
    expect(getLocale()).toBe('en');
    expect(storage.has(PREFERENCES_STORAGE_KEY)).toBe(false);
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

  it('does not collapse multiple saved interests into the first category on cold start', async () => {
    const completed = { ...personalizedPreferences, onboardingComplete: true };
    storage.set(PREFERENCES_STORAGE_KEY, JSON.stringify(completed));
    setDiscoveryFilters({ search: 'apprentice' });

    await loadPreferences();

    expect(getDiscoveryState().filters).toEqual({
      search: 'apprentice',
      country: 'Germany',
      category: undefined,
    });
  });

  it('keeps the effective locale in sync when preferences are saved', async () => {
    setLocale('de');

    await savePreferences({ ...personalizedPreferences, locale: 'en' });

    expect(getLocale()).toBe('en');
    expect(JSON.parse(storage.get(PREFERENCES_STORAGE_KEY) ?? '').locale).toBe('en');
  });

  it('completes onboarding without narrowing multiple interests to technology', async () => {
    setDiscoveryFilters({ search: 'apprentice', radiusKm: 25 });

    const completed = await completeOnboarding(personalizedPreferences);

    expect(completed).toEqual({ ...personalizedPreferences, onboardingComplete: true });
    expect(getDiscoveryState().filters).toEqual({
      search: 'apprentice',
      radiusKm: 25,
      country: 'Germany',
      category: undefined,
    });
    await expect(loadPreferences()).resolves.toEqual(completed);
  });

  it('applies a category only when exactly one interest was selected', async () => {
    await completeOnboarding({ ...personalizedPreferences, interests: ['business'] });
    expect(getDiscoveryState().filters).toMatchObject({ country: 'Germany', category: 'business' });

    resetDiscoveryState();
    await completeOnboarding({ ...personalizedPreferences, interests: ['technology', 'business', 'skilled-trades'] });
    expect(getDiscoveryState().filters).toMatchObject({ country: 'Germany', category: undefined });
  });
});
