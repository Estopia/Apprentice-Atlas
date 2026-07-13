import { describe, expect, it } from 'vitest';
import { serializeJobFilters } from '../supabase/functions/_shared/filter-jobs';

describe('serializeJobFilters', () => {
  it('serializes scalar and array filters while omitting empty values', () => {
    expect(serializeJobFilters({ country: 'DE', tags: ['design', 'it'], radiusKm: 20, search: '' }).toString()).toBe('country=DE&tags=design%2Cit&radiusKm=20');
  });
});

