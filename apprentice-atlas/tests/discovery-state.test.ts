import { beforeEach, describe, expect, it } from 'vitest';

import { getDiscoveryState, resetDiscoveryState, setDiscoveryFilters, setDiscoverySort, updateDiscoveryFilters } from '../src/lib/discovery-state';

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
});
