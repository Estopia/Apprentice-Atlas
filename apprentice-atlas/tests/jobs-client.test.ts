import { describe, expect, it } from 'vitest';

import { escapeSearchPattern, getJob, listJobs } from '../src/lib/jobs';
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

  it('loads an active job when no published translation exists', async () => {
    const row = { id: '11111111-1111-4111-8111-111111111111', title: 'Canonical title', company: 'Canonical company', country: 'Germany', city: 'Berlin', latitude: 52, longitude: 13, job_type: 'apprenticeship', level: 'entry', category: 'general', tags: ['canonical'], raw_description: 'Canonical description', requirements: ['canonical'], source_url: null, application_url: null, source_name: 'official', status: 'active', last_seen_at: 'now', expires_at: null, created_at: 'now', updated_at: 'now', job_translations: [] };
    let nestedTranslationFilterUsed = false;
    const chain: any = {
      select: () => chain,
      eq: (field: string) => { if (field.startsWith('job_translations.')) nestedTranslationFilterUsed = true; return chain; },
      maybeSingle: async () => ({ data: nestedTranslationFilterUsed ? null : row, error: null }),
    };
    const result = await getJob(row.id, { from: () => chain } as any, 'de');
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ title: 'Canonical title', company: 'Canonical company', rawDescription: 'Canonical description', city: 'Berlin' });
  });

  it('discovers active jobs when no published translation exists', async () => {
    const row = { id: '11111111-1111-4111-8111-111111111111', title: 'Canonical title', company: 'Canonical company', country: 'Germany', city: 'Berlin', latitude: null, longitude: null, job_type: 'apprenticeship', level: 'entry', category: 'general', tags: [], raw_description: 'Canonical description', requirements: [], source_url: null, application_url: null, source_name: 'official', status: 'active', last_seen_at: 'now', expires_at: null, created_at: 'now', updated_at: 'now', job_translations: [] };
    let nestedTranslationFilterUsed = false;
    const client = { from: () => {
      const chain: any = {
        select: () => chain,
        eq: (field: string) => { if (field.startsWith('job_translations.')) nestedTranslationFilterUsed = true; return chain; },
        order: () => chain,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: nestedTranslationFilterUsed ? [] : [row], error: null }).then(resolve),
      };
      return chain;
    } };
    const result = await listJobs({}, client as any, undefined, 'de');
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ title: 'Canonical title', rawDescription: 'Canonical description', city: 'Berlin' });
  });

  it('consumes the selected published translation and keeps canonical URL fields', async () => {
    const row = { id: '11111111-1111-4111-8111-111111111111', title: 'Canonical title', company: 'Canonical company', country: 'Germany', city: 'Berlin', latitude: 52, longitude: 13, job_type: 'apprenticeship', level: 'entry', category: 'general', tags: ['canonical'], raw_description: 'Canonical description', requirements: ['canonical'], source_url: 'https://official.example/listing/1', application_url: 'https://apply.example/1', source_name: 'official', status: 'active', last_seen_at: 'now', expires_at: null, created_at: 'now', updated_at: 'now', job_translations: [{ language_code: 'de', status: 'published', title: 'Übersetzter Titel', company: 'Übersetztes Unternehmen', description: 'Übersetzte Beschreibung', requirements: ['Übersetzt'], tags: ['Ausbildung'] }] };
    const chain: any = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
    const result = await getJob(row.id, { from: () => chain } as any, 'de');
    expect(result.data).toMatchObject({ title: 'Übersetzter Titel', company: 'Übersetztes Unternehmen', rawDescription: 'Übersetzte Beschreibung', requirements: ['Übersetzt'], tags: ['Ausbildung'], sourceUrl: row.source_url, applicationUrl: row.application_url });
  });

  it('escapes PostgREST search syntax and wildcard characters', async () => {
    const filters: string[] = [];
    const row = { id: '11111111-1111-4111-8111-111111111111', title: 'Searchable', company: 'Atlas', country: 'Germany', city: 'Berlin', latitude: null, longitude: null, job_type: 'apprenticeship', level: 'entry', category: 'general', tags: [], raw_description: '', requirements: [], source_url: null, application_url: null, source_name: 'official', status: 'active', last_seen_at: 'now', expires_at: null, created_at: 'now', updated_at: 'now' };
    const client = { from: () => { const chain: any = { select: () => chain, eq: () => chain, order: () => chain, or: (filter: string) => { filters.push(filter); return chain; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(resolve) }; return chain; } };
    await listJobs({ search: '100%,(dev)._\\admin' }, client as any, undefined, 'en');
    expect(filters).toEqual([`title.ilike.%${escapeSearchPattern('100%,(dev)._\\admin')}%,company.ilike.%${escapeSearchPattern('100%,(dev)._\\admin')}%`]);
  });

  it('merges the nationwide secondary query during an active radius filter', async () => {
    const row = (id: string, latitude: number | null, longitude: number | null) => ({ id, title: id, company: 'Atlas', country: 'Germany', city: latitude === null ? 'Nationwide' : 'Berlin', latitude, longitude, job_type: 'apprenticeship', level: 'entry', category: 'general', tags: [], raw_description: '', requirements: [], source_url: null, application_url: null, source_name: 'official', status: 'active', last_seen_at: 'now', expires_at: null, created_at: 'now', updated_at: 'now' });
    const queries = [row('nearby', 52.52, 13.405), row('nationwide', null, null)]; let queryIndex = 0;
    const client = { from: () => { const data = queries[queryIndex++]; const chain: any = { select: () => chain, eq: () => chain, order: () => chain, gte: () => chain, lte: () => chain, is: () => chain, overlaps: () => chain, ilike: () => chain, abortSignal: () => chain, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [data], error: null }).then(resolve) }; return chain; } };
    const result = await listJobs({ latitude: 52.52, longitude: 13.405, radiusKm: 50 }, client as any);
    expect(result.error).toBeNull();
    expect(result.data.map((job) => job.id)).toEqual(['nearby', 'nationwide']);
    expect(result.data.find((job) => job.id === 'nationwide')).toMatchObject({ latitude: null, longitude: null });
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
