import type { JobSort } from './discovery-state';
import type { JobFilter } from '@/types/jobs';

export type ActiveFilterEntry =
  | { key: 'search' | 'country' | 'city' | 'category' | 'jobType' | 'level'; value: string }
  | { key: 'radiusKm'; value: number }
  | { key: 'sort'; value: JobSort };

export function getActiveFilterEntries(filters: JobFilter, sort: JobSort): ActiveFilterEntry[] {
  const entries: ActiveFilterEntry[] = [];
  const addText = (key: Extract<ActiveFilterEntry['key'], 'search' | 'country' | 'city' | 'category' | 'jobType' | 'level'>, value: unknown) => {
    if (typeof value === 'string' && value.trim()) entries.push({ key, value: value.trim() });
  };

  addText('search', filters.search);
  addText('country', filters.country);
  addText('city', filters.city);
  addText('category', filters.category);
  addText('jobType', filters.jobType);
  addText('level', filters.level);
  if (typeof filters.radiusKm === 'number' && Number.isFinite(filters.radiusKm)) {
    entries.push({ key: 'radiusKm', value: filters.radiusKm });
  }
  if (sort !== 'recent') entries.push({ key: 'sort', value: sort });

  return entries;
}

export function hasActiveDiscoveryFilters(filters: JobFilter, sort: JobSort): boolean {
  return getActiveFilterEntries(filters, sort).length > 0;
}
