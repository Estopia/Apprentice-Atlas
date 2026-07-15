import type { JobSort } from './discovery-state';
import type { JobFilter } from '@/types/jobs';

export type ActiveFilterEntry =
  | { key: 'search' | 'country' | 'city' | 'category' | 'jobType' | 'level'; value: string }
  | { key: 'radiusKm'; value: number }
  | { key: 'sort'; value: JobSort };

export type LocationFilterTransition =
  | { type: 'select-country'; country: string | undefined }
  | { type: 'set-radius'; radiusKm: number }
  | { type: 'clear-radius' }
  | { type: 'select-sort'; sort: JobSort };

export type DiscoveryFilterState = { filters: JobFilter; sort: JobSort };

export function hasCoordinateLocation(filters: JobFilter): boolean {
  return filters.latitude !== undefined && filters.longitude !== undefined;
}

export function transitionLocationFilter(state: DiscoveryFilterState, action: LocationFilterTransition): DiscoveryFilterState {
  if (action.type === 'select-country') {
    return {
      filters: {
        ...state.filters,
        city: undefined,
        country: action.country,
        latitude: undefined,
        longitude: undefined,
        radiusKm: undefined,
      },
      sort: state.sort === 'distance' ? 'recent' : state.sort,
    };
  }
  if (action.type === 'clear-radius') {
    return { filters: { ...state.filters, radiusKm: undefined }, sort: state.sort };
  }
  if (action.type === 'set-radius') {
    return hasCoordinateLocation(state.filters)
      ? { filters: { ...state.filters, radiusKm: action.radiusKm }, sort: state.sort }
      : state;
  }
  return action.sort === 'distance' && !hasCoordinateLocation(state.filters)
    ? { ...state, sort: 'recent' }
    : { ...state, sort: action.sort };
}

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
