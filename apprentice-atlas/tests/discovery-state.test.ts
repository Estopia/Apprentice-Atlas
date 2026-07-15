import { beforeEach, describe, expect, it } from 'vitest';

import { getDiscoveryState, resetDiscoveryState, setDiscoveryFilters, setDiscoverySort, updateDiscoveryFilters } from '../src/lib/discovery-state';
import { getActiveFilterEntries, hasActiveDiscoveryFilters, transitionLocationFilter } from '../src/lib/filter-presentation';

describe('discovery state', () => {
  beforeEach(resetDiscoveryState);

  it('preserves filters while applying a partial update', () => {
    setDiscoveryFilters({ country: 'Germany', category: 'technology' });
    updateDiscoveryFilters({ radiusKm: 25 });
    expect(getDiscoveryState().filters).toEqual({ country: 'Germany', category: 'technology', radiusKm: 25 });
  });

  it('stores sort order and resets the complete discovery state', () => {
    setDiscoverySort('distance');
    updateDiscoveryFilters({ search: 'software' });
    resetDiscoveryState();
    expect(getDiscoveryState()).toEqual({ filters: {}, sort: 'recent' });
  });

  it('summarizes only active discovery filters and treats the default sort as inactive', () => {
    const entries = getActiveFilterEntries({
      country: 'Germany',
      city: 'Berlin',
      category: 'technology',
      jobType: 'apprenticeship',
      level: 'entry-level',
      radiusKm: 25,
      search: 'software',
      latitude: 52.52,
      longitude: 13.405,
    }, 'recent');

    expect(entries).toEqual([
      { key: 'search', value: 'software' },
      { key: 'country', value: 'Germany' },
      { key: 'city', value: 'Berlin' },
      { key: 'category', value: 'technology' },
      { key: 'jobType', value: 'apprenticeship' },
      { key: 'level', value: 'entry-level' },
      { key: 'radiusKm', value: 25 },
    ]);
    expect(hasActiveDiscoveryFilters({}, 'recent')).toBe(false);
    expect(hasActiveDiscoveryFilters({}, 'distance')).toBe(true);
  });

  it('never presents coordinates or an unsupported language filter as active chips', () => {
    expect(getActiveFilterEntries({ latitude: 51.5, longitude: -0.12 }, 'recent')).toEqual([]);
  });

  it('switches coherently from coordinate search to a country filter', () => {
    expect(transitionLocationFilter({
      filters: { city: 'Old city', latitude: 51.5, longitude: -0.12, radiusKm: 25, category: 'technology' },
      sort: 'distance',
    }, { type: 'select-country', country: 'United Kingdom' })).toEqual({
      filters: { city: undefined, country: 'United Kingdom', latitude: undefined, longitude: undefined, radiusKm: undefined, category: 'technology' },
      sort: 'recent',
    });
  });

  it('keeps coordinates when only radius is cleared and rejects distance sort without them', () => {
    const coordinateState = transitionLocationFilter({
      filters: { latitude: 52.52, longitude: 13.405, radiusKm: 50 },
      sort: 'distance',
    }, { type: 'clear-radius' });

    expect(coordinateState).toEqual({
      filters: { latitude: 52.52, longitude: 13.405, radiusKm: undefined },
      sort: 'distance',
    });
    expect(getActiveFilterEntries(coordinateState.filters, coordinateState.sort)).toEqual([
      { key: 'sort', value: 'distance' },
    ]);
    expect(transitionLocationFilter({ filters: { country: 'Germany' }, sort: 'recent' }, { type: 'select-sort', sort: 'distance' })).toEqual({
      filters: { country: 'Germany' },
      sort: 'recent',
    });
  });
});
