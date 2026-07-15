import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  failGet: false,
  failSet: false,
  failRemove: false,
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => {
      if (storage.failGet) throw new Error('read failed');
      return storage.values.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (storage.failSet) throw new Error('write failed');
      storage.values.set(key, value);
    },
    removeItem: async (key: string) => {
      if (storage.failRemove) throw new Error('remove failed');
      storage.values.delete(key);
    },
  },
}));

// AsyncStorage must be mocked before the module under test is imported.
// eslint-disable-next-line import/first
import {
  clearRecentSearches,
  loadRecentSearches,
  normalizeRecentSearch,
  RECENT_SEARCHES_KEY,
  saveRecentSearch,
} from '../src/lib/recent-searches';

describe('recent searches', () => {
  beforeEach(() => {
    storage.values.clear();
    storage.failGet = false;
    storage.failSet = false;
    storage.failRemove = false;
  });

  it('trims, collapses whitespace, and caps searches at 100 characters', () => {
    expect(normalizeRecentSearch('  software\n\t apprentice  ')).toBe('software apprentice');
    expect(normalizeRecentSearch(`  ${'a'.repeat(110)}  `)).toBe('a'.repeat(100));
    expect(normalizeRecentSearch('🧭'.repeat(110))).toBe('🧭'.repeat(100));
  });

  it('deduplicates case-insensitively, keeps newest first, and stores at most five', async () => {
    for (const query of ['One', 'Two', 'Three', 'Four', 'Five', 'Six', '  THREE  ']) {
      await saveRecentSearch(query);
    }

    expect(await loadRecentSearches()).toEqual(['THREE', 'Six', 'Five', 'Four', 'Two']);
    expect(JSON.parse(storage.values.get(RECENT_SEARCHES_KEY) ?? '[]')).toEqual(['THREE', 'Six', 'Five', 'Four', 'Two']);
  });

  it('ignores empty searches and safely falls back on corrupt or unavailable storage', async () => {
    storage.values.set(RECENT_SEARCHES_KEY, '{bad json');
    await expect(loadRecentSearches()).resolves.toEqual([]);
    await expect(saveRecentSearch('   ')).resolves.toEqual([]);

    storage.failGet = true;
    storage.failSet = true;
    await expect(loadRecentSearches()).resolves.toEqual([]);
    await expect(saveRecentSearch('Plumber')).resolves.toEqual(['Plumber']);
  });

  it('clears searches without surfacing storage failures', async () => {
    storage.values.set(RECENT_SEARCHES_KEY, JSON.stringify(['Developer']));
    await expect(clearRecentSearches()).resolves.toBeUndefined();
    expect(await loadRecentSearches()).toEqual([]);

    storage.failRemove = true;
    await expect(clearRecentSearches()).resolves.toBeUndefined();
  });
});
