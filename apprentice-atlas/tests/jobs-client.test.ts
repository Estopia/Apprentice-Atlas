import { describe, expect, it } from 'vitest';

import { getJob } from '../src/lib/jobs';
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

  it('loads active nationwide jobs and preserves null source/application URLs', async () => {
    const row = { id: '11111111-1111-4111-8111-111111111111', title: 'Nationwide', company: 'Atlas', country: 'Germany', city: 'Nationwide', latitude: null, longitude: null, job_type: 'apprenticeship', level: 'entry', category: 'general', tags: null, raw_description: '', requirements: null, source_url: null, application_url: null, source_name: 'official', status: 'active', last_seen_at: 'now', expires_at: null, created_at: 'now', updated_at: 'now' };
    const chain: any = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
    const result = await getJob(row.id, { from: () => chain } as any);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ city: 'Nationwide', latitude: null, longitude: null, sourceUrl: null, applicationUrl: null });
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
