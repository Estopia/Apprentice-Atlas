import { describe, expect, it } from 'vitest';
import { normalizeJob } from '../supabase/functions/_shared/normalize-job';
import { dedupeByExternalId } from '../supabase/functions/_shared/source-adapter';
import { UkApprenticeshipAdapter } from '../supabase/functions/_shared/uk-apprenticeship-adapter';
import { BA_OFFICIAL_CONTRACT_UNCONFIRMED, createBaAdapter } from '../supabase/functions/_shared/ba-adapter';

const validRecord = {
  vacancyReference: ' uk-123 ',
  title: '  Software apprentice  ',
  employerName: '  Atlas Ltd  ',
  vacancyUrl: 'https://example.test/vacancies/uk-123',
  applicationUrl: 'https://example.test/jobs/uk-123',
  addresses: [{ address: { town: '  London ', country: ' UK ' }, latitude: '51.5072', longitude: '-0.1276' }],
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
    expect(normalized?.job.sourceUrl).toBe('https://example.test/vacancies/uk-123');
    expect(normalized?.job.applicationUrl).toBe('https://example.test/jobs/uk-123');
    expect(normalized?.rawRecord).toBe(validRecord);
  });

  it.each([
    ['title', { ...validRecord, title: ' ' }],
    ['source ID', { ...validRecord, vacancyReference: undefined }],
    ['source URL', { ...validRecord, vacancyUrl: undefined, applicationUrl: undefined }],
    ['company', { ...validRecord, employerName: undefined }],
  ])('rejects records missing %s', (_, record) => {
    expect(normalizeJob(record, { provider: 'test' })).toBeNull();
  });

  it('rejects one-sided, non-numeric, and out-of-range coordinates', () => {
    for (const coordinates of [
      { latitude: 52 },
      { latitude: 'not-a-number', longitude: 13 },
      { latitude: 91, longitude: 13 },
      { latitude: 52, longitude: 181 },
    ]) {
      expect(normalizeJob({ ...validRecord, addresses: [{ address: { town: 'Berlin' }, ...coordinates }] }, { provider: 'test', defaultCountry: 'Germany' })).toBeNull();
    }
  });

  it('accepts coordinate-only locations with an explicit fallback city', () => {
    const normalized = normalizeJob({ ...validRecord, addresses: [{ latitude: 52, longitude: 13 }] }, { provider: 'test', defaultCountry: 'Germany' });
    expect(normalized?.job.city).toBe('Unknown');
    expect(normalized?.job.country).toBe('Germany');
  });

  it('accepts nationwide listings without addresses or coordinates', () => {
    const normalized = normalizeJob({ ...validRecord, addresses: undefined, vacancyUrl: undefined }, { provider: 'test', defaultCountry: 'United Kingdom' });
    expect(normalized?.job.latitude).toBeNull();
    expect(normalized?.job.longitude).toBeNull();
    expect(normalized?.job.city).toBe('Unknown');
  });

  it('keeps the last occurrence of duplicate external IDs', () => {
    expect(dedupeByExternalId([{ externalId: 'a', value: 1 }, { externalId: 'a', value: 2 }, { externalId: 'b', value: 3 }])).toEqual([{ externalId: 'a', value: 2 }, { externalId: 'b', value: 3 }]);
  });
});

describe('official source adapters', () => {
  it('uses the UK API key and v2 headers and extracts official URL/id', async () => {
    let request: Request | URL | string | undefined;
    let init: RequestInit | undefined;
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', pageSize: 2, fetcher: async (input, options) => {
      request = input;
      init = options;
      return new Response(JSON.stringify({ vacancies: [validRecord], totalPages: 2 }), { status: 200 });
    } });
    const page = await adapter.fetchPage(null);
    const normalized = adapter.normalize(page.records[0]);
    const requestUrl = new URL(String(request));
    expect(requestUrl.pathname).toBe('/vacancies/vacancy');
    expect(requestUrl.searchParams.get('PageNumber')).toBe('1');
    expect(requestUrl.searchParams.get('PageSize')).toBe('2');
    expect(new Headers(init?.headers).get('Ocp-Apim-Subscription-Key')).toBe('secret');
    expect(new Headers(init?.headers).get('X-Version')).toBe('2');
    expect(normalized?.externalId).toBe('uk-123');
    expect(normalized?.sourceUrl).toBe('https://example.test/vacancies/uk-123');
    expect(normalized?.rawRecord.applicationUrl).toBe('https://example.test/jobs/uk-123');
    expect(page.nextCursor).toBe('2');
    expect(page.complete).toBe(false);
  });

  it('completes UK pagination at totalPages', async () => {
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', fetcher: async () => new Response(JSON.stringify({ vacancies: [], totalPages: 2 }), { status: 200 }) });
    const page = await adapter.fetchPage('2');
    expect(page.nextCursor).toBeNull();
    expect(page.complete).toBe(true);
  });

  it('treats totalPages zero as a completed empty sync', async () => {
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', fetcher: async () => new Response(JSON.stringify({ vacancies: [], totalPages: 0 }), { status: 200 }) });
    await expect(adapter.fetchPage(null)).resolves.toEqual({ records: [], nextCursor: null, complete: true });
  });

  it('fails when UK totalPages metadata is missing or malformed', async () => {
    for (const metadata of [{}, { totalPages: 'not-a-number' }, { totalPages: 1.5 }]) {
      const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', fetcher: async () => new Response(JSON.stringify({ vacancies: [], ...metadata }), { status: 200 }) });
      await expect(adapter.fetchPage(null)).rejects.toMatchObject({ code: 'SOURCE_PAGINATION_ERROR' });
    }
  });

  it('fails BA ingestion clearly when its official read configuration is absent', async () => {
    expect(() => createBaAdapter()).toThrowError(expect.objectContaining({ code: BA_OFFICIAL_CONTRACT_UNCONFIRMED }));
  });
});
