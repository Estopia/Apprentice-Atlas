import { describe, expect, it } from 'vitest';
import { normalizeJob } from '../supabase/functions/_shared/normalize-job';
import { dedupeByExternalId } from '../supabase/functions/_shared/source-adapter';
import { UkApprenticeshipAdapter } from '../supabase/functions/_shared/uk-apprenticeship-adapter';
import { BaAdapter } from '../supabase/functions/_shared/ba-adapter';

const validRecord = {
  id: ' uk-123 ',
  title: '  Software apprentice  ',
  employer: { name: '  Atlas Ltd  ' },
  location: { city: '  London ', country: ' UK ' },
  latitude: '51.5072',
  longitude: '-0.1276',
  url: 'https://example.test/jobs/uk-123',
  description: 'Build useful things.',
};

describe('normalizeJob', () => {
  it('trims fields and preserves valid coordinates', () => {
    const normalized = normalizeJob(validRecord, { provider: 'test', defaultCountry: 'United Kingdom' });
    expect(normalized?.externalId).toBe('uk-123');
    expect(normalized?.job.title).toBe('Software apprentice');
    expect(normalized?.job.company).toBe('Atlas Ltd');
    expect(normalized?.job.city).toBe('London');
    expect(normalized?.job.latitude).toBe(51.5072);
    expect(normalized?.job.longitude).toBe(-0.1276);
    expect(normalized?.rawRecord).toBe(validRecord);
  });

  it.each([
    ['title', { ...validRecord, title: ' ' }],
    ['source ID', { ...validRecord, id: undefined }],
    ['source URL', { ...validRecord, url: undefined }],
    ['company', { ...validRecord, employer: undefined }],
    ['location', { ...validRecord, location: undefined, latitude: undefined, longitude: undefined }],
  ])('rejects records missing %s', (_, record) => {
    expect(normalizeJob(record, { provider: 'test' })).toBeNull();
  });

  it('accepts coordinate-only locations with an explicit fallback city', () => {
    const normalized = normalizeJob({ ...validRecord, location: undefined, latitude: 52, longitude: 13 }, { provider: 'test', defaultCountry: 'Germany' });
    expect(normalized?.job.city).toBe('Unknown');
    expect(normalized?.job.country).toBe('Germany');
  });

  it('keeps the last occurrence of duplicate external IDs', () => {
    expect(dedupeByExternalId([{ externalId: 'a', value: 1 }, { externalId: 'a', value: 2 }, { externalId: 'b', value: 3 }])).toEqual([{ externalId: 'a', value: 2 }, { externalId: 'b', value: 3 }]);
  });
});

describe('official source adapters', () => {
  it('uses the UK API key and v2 headers and extracts official URL/id', async () => {
    let request: Request | URL | string | undefined;
    let init: RequestInit | undefined;
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', fetcher: async (input, options) => {
      request = input;
      init = options;
      return new Response(JSON.stringify({ vacancies: [validRecord] }), { status: 200 });
    } });
    const page = await adapter.fetchPage(null);
    const normalized = adapter.normalize(page.records[0]);
    expect(new URL(String(request)).pathname).toBe('/vacancies');
    expect(new Headers(init?.headers).get('Ocp-Apim-Subscription-Key')).toBe('secret');
    expect(new Headers(init?.headers).get('X-Version')).toBe('2');
    expect(normalized?.externalId).toBe('uk-123');
    expect(normalized?.sourceUrl).toBe('https://example.test/jobs/uk-123');
  });

  it('fails BA ingestion clearly when its official read configuration is absent', async () => {
    await expect(new BaAdapter({ endpoint: '', apiKey: '' }).fetchPage(null)).rejects.toMatchObject({ code: 'SOURCE_CONFIGURATION_ERROR' });
  });
});
