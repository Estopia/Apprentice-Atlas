import { describe, expect, it } from 'vitest';

import { hasMapPosition, serializeJobFilters } from '../src/lib/job-filters';
import { applyDeviceLocationFilters, applyManualLocationFilters, manualLocation } from '../src/lib/location';

describe('client job filters', () => {
  it('serializes active filters without empty values and removes duplicate tags', () => {
    expect(serializeJobFilters({ country: ' Germany ', city: ' ', tags: ['web', 'web', ''] })).toEqual({ status: 'active', country: 'Germany', tags: ['web'] });
  });

  it('keeps nationwide jobs out of map positions but available to the list', () => {
    expect(hasMapPosition({ latitude: null, longitude: null })).toBe(false);
    expect(hasMapPosition({ latitude: 52.52, longitude: 13.4 })).toBe(true);
  });

  it('accepts a complete manual location and rejects incomplete fallback input', () => {
    expect(manualLocation(' Berlin ', ' Germany ')).toEqual({ city: 'Berlin', country: 'Germany' });
    expect(manualLocation('', 'Germany')).toBeNull();
  });

  it('clears device coordinates and radius when switching to manual location', () => {
    expect(applyManualLocationFilters({ latitude: 52.52, longitude: 13.405, radiusKm: 50, category: 'technology' }, ' Berlin ', ' Germany ')).toEqual({ category: 'technology', city: 'Berlin', country: 'Germany' });
  });

  it('clears manual city and country when switching to device location', () => {
    expect(applyDeviceLocationFilters({ city: 'Berlin', country: 'Germany', category: 'technology' }, 52.52, 13.405)).toEqual({ city: undefined, country: undefined, category: 'technology', latitude: 52.52, longitude: 13.405, radiusKm: 50 });
  });
});
