import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { storage.set(key, value); },
  },
}));

import { getLocale, hydrateLocale, LOCALE_STORAGE_KEY, setLocale } from '../src/lib/i18n';

describe('locale persistence', () => {
  beforeEach(() => {
    storage.clear();
    setLocale('de');
  });

  it('persists DE/EN selection without requiring authentication', async () => {
    setLocale('en');
    expect(storage.get(LOCALE_STORAGE_KEY)).toBe('en');
    await hydrateLocale();
    expect(getLocale()).toBe('en');
  });

  it('hydrates a stored locale and falls back to DE for invalid values', async () => {
    storage.set(LOCALE_STORAGE_KEY, 'en');
    await hydrateLocale();
    expect(getLocale()).toBe('en');
    storage.set(LOCALE_STORAGE_KEY, 'fr');
    setLocale('de');
    await hydrateLocale();
    expect(getLocale()).toBe('de');
  });
});
