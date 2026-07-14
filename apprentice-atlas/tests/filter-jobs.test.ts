import { describe, expect, it } from 'vitest';
import { normalizeJobFilters, serializeJobFilters } from '../supabase/functions/_shared/filter-jobs';

describe('serializeJobFilters', () => {
  it('serializes scalar and array filters while omitting empty values', () => {
    expect(serializeJobFilters({ country: ' DE ', tags: [' design ', ' ', 'it'], latitude: 52, longitude: 13, radiusKm: 20, search: '' }).toString()).toBe('country=DE&tags=design%2Cit&latitude=52&longitude=13&radiusKm=20');
  });

  it('omits incomplete coordinate/radius filters and trims scalar values', () => {
    expect(normalizeJobFilters({ city: ' Berlin ', tags: [' ', ' engineering '], latitude: 52, radiusKm: 0 })).toEqual({ city: 'Berlin', tags: ['engineering'] });
    expect(serializeJobFilters({ latitude: 52, radiusKm: 10 }).toString()).toBe('');
  });
});
