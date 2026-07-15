import AsyncStorage from '@react-native-async-storage/async-storage';

export const RECENT_SEARCHES_KEY = 'apprentice-atlas:recent-searches';

const MAX_SEARCH_LENGTH = 100;
const MAX_RECENT_SEARCHES = 5;

export function normalizeRecentSearch(query: string): string {
  const normalized = query.trim().replace(/\s+/g, ' ');
  return Array.from(normalized).slice(0, MAX_SEARCH_LENGTH).join('').trimEnd();
}

function normalizeSearchList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const searches: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const query = normalizeRecentSearch(item);
    const dedupeKey = query.toLowerCase();
    if (!query || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    searches.push(query);
    if (searches.length === MAX_RECENT_SEARCHES) break;
  }
  return searches;
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    return stored === null ? [] : normalizeSearchList(JSON.parse(stored));
  } catch {
    return [];
  }
}

export async function saveRecentSearch(query: string): Promise<string[]> {
  const normalizedQuery = normalizeRecentSearch(query);
  if (!normalizedQuery) return loadRecentSearches();

  const current = await loadRecentSearches();
  const dedupeKey = normalizedQuery.toLowerCase();
  const next = [
    normalizedQuery,
    ...current.filter((item) => item.toLowerCase() !== dedupeKey),
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Recent searches are optional UI state; callers still receive the in-memory result.
  }

  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Clearing optional UI state must not interrupt navigation or search.
  }
}
