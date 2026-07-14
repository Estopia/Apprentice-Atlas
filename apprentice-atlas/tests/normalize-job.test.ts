import { describe, expect, it } from 'vitest';
import { normalizeJob } from '../supabase/functions/_shared/normalize-job';
import { dedupeByExternalId, SourceConfigurationError } from '../supabase/functions/_shared/source-adapter';
import { UK_OFFICIAL_CONTRACT_UNCONFIRMED, UkApprenticeshipAdapter } from '../supabase/functions/_shared/uk-apprenticeship-adapter';
import { BaAdapter } from '../supabase/functions/_shared/ba-adapter';

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
    const normalized = normalizeJob({ ...validRecord, addresses: undefined }, { provider: 'test', defaultCountry: 'United Kingdom' });
    expect(normalized?.job.latitude).toBeNull();
    expect(normalized?.job.longitude).toBeNull();
    expect(normalized?.job.city).toBe('Unknown');
  });

  it('never copies an application destination into the official source URL', () => {
    const applicationOnly = normalizeJob({ ...validRecord, vacancyUrl: undefined, sourceUrl: undefined, applicationUrl: 'https://example.test/apply-only' }, { provider: 'test' });
    expect(applicationOnly).toBeNull();
    const missingBoth = normalizeJob({ ...validRecord, vacancyUrl: undefined, sourceUrl: undefined, applicationUrl: undefined }, { provider: 'test' });
    expect(missingBoth).toBeNull();
  });

  it('rejects a blank or malformed official listing URL without copying applicationUrl', () => {
    for (const sourceUrl of [' ', 'not-a-url', 'https://?', 'https://', 'http:///', ' https://example.test/listing/1 junk', 'javascript:alert(1)']) {
      expect(normalizeJob({ ...validRecord, vacancyUrl: sourceUrl, sourceUrl: undefined }, { provider: 'test' })).toBeNull();
    }
  });

  it('keeps sourceUrl required while dropping an invalid independent applicationUrl', () => {
    const normalized = normalizeJob({ ...validRecord, applicationUrl: 'javascript:alert(1)' }, { provider: 'test' });
    expect(normalized?.job.sourceUrl).toBe(validRecord.vacancyUrl);
    expect(normalized?.job.applicationUrl).toBeNull();
    expect(normalizeJob({ ...validRecord, applicationUrl: ' https://apply.example.test/path ' }, { provider: 'test' })?.job.applicationUrl).toBe('https://apply.example.test/path');
  });

  it('accepts http and https listing URLs with a hostname', () => {
    for (const sourceUrl of ['http://example.test/listing/1', 'https://example.test/listing/1?source=official']) {
      const normalized = normalizeJob({ ...validRecord, vacancyUrl: sourceUrl }, { provider: 'test' });
      expect(normalized?.sourceUrl).toBe(sourceUrl);
      expect(normalized?.job.sourceUrl).toBe(sourceUrl);
    }
  });

  it('keeps the last occurrence of duplicate external IDs', () => {
    expect(dedupeByExternalId([{ externalId: 'a', value: 1 }, { externalId: 'a', value: 2 }, { externalId: 'b', value: 3 }])).toEqual([{ externalId: 'a', value: 2 }, { externalId: 'b', value: 3 }]);
  });
});

describe('official source adapters', () => {
  it('requires explicit BA enablement and credentials', () => {
    expect(() => new BaAdapter()).toThrow(SourceConfigurationError);
    expect(() => new BaAdapter({ enabled: true, apiKey: 'secret' })).toThrow(/BA_API_URL/i);
    expect(() => new BaAdapter({ enabled: true, endpoint: 'https://ba.example.test/jobs' })).toThrow(/BA_API_KEY/i);
    expect(() => new BaAdapter({ enabled: true, endpoint: 'https://ba.example.test/jobs', apiKey: 'secret' })).not.toThrow();
  });
  it('uses the UK API key and v2 headers and extracts official URL/id', async () => {
    let request: Request | URL | string | undefined;
    let init: RequestInit | undefined;
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', contractConfirmed: true, pageSize: 2, fetcher: async (input, options) => {
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

  it('normalizes the Display Advert API v2 address and course fields', () => {
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', contractConfirmed: true });
    const normalized = adapter.normalize({
      vacancyReference: '1000270243',
      vacancyUrl: 'https://www.findapprenticeship.service.gov.uk/apprenticeship/reference/1000270243',
      title: 'Apprentice Maintenance Engineer',
      employerName: 'Atlas Engineering Ltd',
      description: '<p>Learn planned &amp; reactive maintenance.</p><ul><li>Work safely</li></ul>',
      apprenticeshipLevel: 'Intermediate',
      course: { level: 2, route: 'Engineering and manufacturing', title: 'Engineering operative (level 2)' },
      addresses: [{ addressLine2: 'Hanley', addressLine3: 'Stoke-On-Trent', postcode: 'ST1 5HR', latitude: 53.02715, longitude: -2.17969 }],
    });
    expect(normalized?.job).toMatchObject({
      city: 'Stoke-On-Trent',
      country: 'United Kingdom',
      jobType: 'apprenticeship',
      level: 'entry',
      category: 'skilled-trades',
      sourceName: 'Find an apprenticeship',
      latitude: 53.02715,
      longitude: -2.17969,
      tags: ['Engineering and manufacturing', 'Engineering operative (level 2)', 'Intermediate'],
    });
    expect(normalized?.rawRecord).not.toHaveProperty('city');
    expect(normalized?.job.rawDescription).toBe('Learn planned & reactive maintenance.\n• Work safely');
  });

  it('completes UK pagination at totalPages', async () => {
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', contractConfirmed: true, fetcher: async () => new Response(JSON.stringify({ vacancies: [], totalPages: 2 }), { status: 200 }) });
    const page = await adapter.fetchPage('2');
    expect(page.nextCursor).toBeNull();
    expect(page.complete).toBe(true);
  });

  it('treats totalPages zero as a completed empty sync', async () => {
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', contractConfirmed: true, fetcher: async () => new Response(JSON.stringify({ vacancies: [], totalPages: 0 }), { status: 200 }) });
    await expect(adapter.fetchPage(null)).resolves.toEqual({ records: [], nextCursor: null, complete: true });
  });

  it('fails when UK totalPages metadata is missing or malformed', async () => {
    for (const metadata of [{}, { totalPages: 'not-a-number' }, { totalPages: 1.5 }]) {
      const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', contractConfirmed: true, fetcher: async () => new Response(JSON.stringify({ vacancies: [], ...metadata }), { status: 200 }) });
      await expect(adapter.fetchPage(null)).rejects.toMatchObject({ code: 'SOURCE_PAGINATION_ERROR' });
    }
  });

  it('refuses UK synchronization until the official contract is explicitly confirmed', () => {
    expect(() => new UkApprenticeshipAdapter({ apiKey: 'secret' })).toThrowError(expect.objectContaining({ code: UK_OFFICIAL_CONTRACT_UNCONFIRMED }));
  });

  it('uses the official BA Ausbildung search contract and normalizes Germany-only records', async () => {
    const requests: Array<{ input: Request | URL | string; init?: RequestInit }> = [];
    const baRecord = {
      beruf: 'Fachinformatiker/in - Anwendungsentwicklung',
      titel: 'Ausbildung Fachinformatiker/in (m/w/d)',
      refnr: '10001-1234567890-S',
      arbeitgeber: 'Atlas GmbH',
      arbeitsort: { ort: 'Berlin', land: 'Deutschland', koordinaten: { lat: 52.52, lon: 13.405 } },
      externeUrl: 'https://atlas.example/apply/123',
    };
    const baDetail = {
      referenznummer: baRecord.refnr,
      stellenangebotsTitel: baRecord.titel,
      firma: baRecord.arbeitgeber,
      hauptberuf: baRecord.beruf,
      stellenangebotsBeschreibung: '<p>Du entwickelst Anwendungen.</p><ul><li>Im Team arbeiten</li></ul>',
      geforderterBildungsabschluss: 'MITTLERE_REIFE',
      veroeffentlichungszeitraum: { von: '2026-07-14', bis: '2026-08-31' },
    };
    const adapter = new BaAdapter({ enabled: true, endpoint: 'https://rest.example.test/jobboerse/jobsuche-service/pc/v4/jobs', apiKey: 'jobboerse-jobsuche', pageSize: 2, fetcher: async (input, options) => {
      requests.push({ input, init: options });
      const requestUrl = new URL(String(input));
      return requestUrl.pathname.includes('/jobdetails/')
        ? new Response(JSON.stringify(baDetail), { status: 200 })
        : new Response(JSON.stringify({ stellenangebote: [baRecord], maxErgebnisse: 3, page: 1, size: 2 }), { status: 200 });
    } });
    const page = await adapter.fetchPage(null);
    const normalized = adapter.normalize(page.records[0]);
    const requestUrl = new URL(String(requests[0].input));
    const detailUrl = new URL(String(requests[1].input));
    expect(requestUrl.pathname).toBe('/jobboerse/jobsuche-service/pc/v4/jobs');
    expect(requestUrl.searchParams.get('angebotsart')).toBe('4');
    expect(requestUrl.searchParams.get('page')).toBe('1');
    expect(requestUrl.searchParams.get('size')).toBe('2');
    expect(new Headers(requests[0].init?.headers).get('X-API-Key')).toBe('jobboerse-jobsuche');
    expect(detailUrl.pathname).toBe('/jobboerse/jobsuche-service/pc/v4/jobdetails/MTAwMDEtMTIzNDU2Nzg5MC1T');
    expect(new Headers(requests[1].init?.headers).get('X-API-Key')).toBe('jobboerse-jobsuche');
    expect(normalized?.externalId).toBe('10001-1234567890-S');
    expect(normalized?.sourceUrl).toBe('https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1234567890-S');
    expect(normalized?.job.country).toBe('Germany');
    expect(normalized?.job.city).toBe('Berlin');
    expect(normalized?.job.sourceName).toBe('Bundesagentur für Arbeit');
    expect(normalized?.job.rawDescription).toBe('Du entwickelst Anwendungen.\n• Im Team arbeiten');
    expect(normalized?.job.requirements).toEqual(['Mittlerer Schulabschluss']);
    expect(normalized?.job.tags).toEqual(['Fachinformatiker/in - Anwendungsentwicklung', 'Mittlerer Schulabschluss']);
    expect(normalized?.job.category).toBe('technology');
    expect(normalized?.job.expiresAt).toBe('2026-08-31');
    expect(normalized?.job.applicationUrl).toBe('https://atlas.example/apply/123');
    expect(normalized?.rawRecord).toEqual({ ...baRecord, detail: baDetail });
    expect(page.nextCursor).toBe('2');
    expect(page.complete).toBe(false);
  });

  it('keeps a BA search record when its detail disappears during synchronization', async () => {
    const baRecord = { refnr: '10001-1234567890-S', titel: 'Ausbildung', arbeitgeber: 'Atlas GmbH', beruf: 'Kaufmann/-frau', arbeitsort: { ort: 'Berlin', land: 'Deutschland' } };
    const adapter = new BaAdapter({ enabled: true, endpoint: 'https://ba.example.test/pc/v4/jobs', apiKey: 'secret', fetcher: async (input) => {
      return String(input).includes('/jobdetails/')
        ? new Response(null, { status: 404 })
        : new Response(JSON.stringify({ stellenangebote: [baRecord], maxErgebnisse: 1, page: 1, size: 100 }), { status: 200 });
    } });
    const page = await adapter.fetchPage(null);
    expect(page.records).toEqual([baRecord]);
    expect(adapter.normalize(page.records[0])?.job.rawDescription).toBe('');
  });

  it('rejects non-Germany BA records and malformed pagination metadata', async () => {
    const outsideGermanyRecord = { refnr: 'at-1', titel: 'Lehrstelle', arbeitgeber: 'Austria GmbH', arbeitsort: { ort: 'Wien', land: 'Österreich' } };
    const adapter = new BaAdapter({ enabled: true, endpoint: 'https://ba.example.test/jobs', apiKey: 'secret', fetchDetails: false, fetcher: async () => new Response(JSON.stringify({ stellenangebote: [outsideGermanyRecord], maxErgebnisse: 1, page: 1, size: 1 }), { status: 200 }) });
    const page = await adapter.fetchPage(null);
    expect(adapter.normalize(page.records[0])).toBeNull();
    const malformed = new BaAdapter({ enabled: true, endpoint: 'https://ba.example.test/jobs', apiKey: 'secret', fetchDetails: false, fetcher: async () => new Response(JSON.stringify({ stellenangebote: [], page: 1, size: 1 }), { status: 200 }) });
    await expect(malformed.fetchPage(null)).rejects.toMatchObject({ code: 'SOURCE_PAGINATION_ERROR' });
  });
});
