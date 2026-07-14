import { normalizeJob } from './normalize-job.ts';
import { asRecord, asString, getEnv, SourceConfigurationError, SourceFetchError, SourcePaginationError, type NormalizedSourceRecord, type SourceAdapter, type SourcePage, type SourceRecord } from './source-adapter.ts';

const PAGE_SIZE = 100;
const DETAIL_CONCURRENCY = 4;

export interface BaJobRecord extends SourceRecord {
  refnr?: string;
  titel?: string;
  arbeitgeber?: string;
  arbeitsort?: SourceRecord;
  externeUrl?: string | null;
  detail?: BaJobDetail;
}

export interface BaJobDetail extends SourceRecord {
  referenznummer?: string;
  stellenangebotsTitel?: string;
  firma?: string;
  hauptberuf?: string;
  stellenangebotsBeschreibung?: string;
  geforderterBildungsabschluss?: string;
  verguetungsangabe?: string;
  ausbildungsart?: string;
  stellenlokationen?: unknown;
  veroeffentlichungszeitraum?: SourceRecord;
}

interface BaSearchResponse extends SourceRecord {
  stellenangebote?: unknown;
  maxErgebnisse?: unknown;
  page?: unknown;
  size?: unknown;
}

const integer = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const jobDetailUrl = (reference: string): string => `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(reference)}`;

const detailApiUrl = (endpoint: string): string => endpoint.replace(/\/jobs\/?$/, '/jobdetails');

const referenceToken = (reference: string): string => {
  if (typeof btoa !== 'function') throw new SourceConfigurationError('The BA detail API requires a Base64-capable runtime');
  return btoa(reference);
};

const readableEducation = (value: string | null): string | null => {
  if (!value || value === 'NICHT_RELEVANT' || value === 'KEINE_ANGABE') return null;
  const labels: Record<string, string> = {
    HAUPTSCHULABSCHLUSS: 'Hauptschulabschluss',
    MITTLERE_REIFE: 'Mittlerer Schulabschluss',
    FACHHOCHSCHULREIFE: 'Fachhochschulreife',
    ABITUR: 'Abitur',
  };
  return labels[value] ?? value.toLocaleLowerCase('de-DE').replace(/_/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('de-DE'));
};

const canonicalCategory = (value: string): string => {
  const normalized = value.toLocaleLowerCase('de-DE');
  if (/informatik|software|digital|daten|it\b|elektronik/.test(normalized)) return 'technology';
  if (/kauf|handel|bank|büro|verwaltung|marketing|verkauf|versicherung/.test(normalized)) return 'business';
  if (/bau|mechanik|mechatronik|handwerk|technik|logistik|lager|produktion|industrie/.test(normalized)) return 'skilled-trades';
  return 'general';
};

const detailLocation = (detail: SourceRecord | null): SourceRecord | null => {
  const locations = detail?.stellenlokationen;
  return Array.isArray(locations) ? asRecord(locations[0]) : null;
};

const officialRecord = (record: BaJobRecord): SourceRecord | null => {
  const detail = asRecord(record.detail);
  const searchLocation = asRecord(record.arbeitsort);
  const fallbackLocation = detailLocation(detail);
  const fallbackAddress = asRecord(fallbackLocation?.adresse);
  const coordinates = asRecord(searchLocation?.koordinaten);
  const country = asString(searchLocation?.land) ?? asString(fallbackAddress?.land);
  if (country?.toLocaleUpperCase('de-DE') !== 'DEUTSCHLAND') return null;
  const occupation = asString(detail?.hauptberuf) ?? asString(record.beruf) ?? '';
  const education = readableEducation(asString(detail?.geforderterBildungsabschluss));
  const publication = asRecord(detail?.veroeffentlichungszeitraum);
  return {
    ...record,
    externalId: asString(record.refnr),
    sourceUrl: jobDetailUrl(asString(record.refnr)!),
    applicationUrl: asString(record.externeUrl),
    title: asString(detail?.stellenangebotsTitel) ?? asString(record.titel),
    company: asString(detail?.firma) ?? asString(record.arbeitgeber),
    city: asString(searchLocation?.ort) ?? asString(fallbackAddress?.ort),
    country: 'Germany',
    latitude: coordinates?.lat ?? fallbackLocation?.breite,
    longitude: coordinates?.lon ?? fallbackLocation?.laenge,
    rawDescription: asString(detail?.stellenangebotsBeschreibung),
    requirements: education ? [education] : [],
    category: canonicalCategory(occupation),
    tags: [occupation, education].filter((value): value is string => Boolean(value)),
    expiresAt: asString(publication?.bis),
  };
};

export class BaAdapter implements SourceAdapter<BaJobRecord> {
  readonly provider = 'bundesagentur-fuer-arbeit';
  private readonly endpoint: string;
  private readonly detailEndpoint: string;
  private readonly apiKey: string;
  private readonly pageSize: number;
  private readonly fetchDetails: boolean;
  private readonly detailConcurrency: number;
  private readonly fetcher: typeof fetch;

  constructor(options: { enabled?: boolean; endpoint?: string; detailEndpoint?: string; apiKey?: string; pageSize?: number; fetchDetails?: boolean; detailConcurrency?: number; fetcher?: typeof fetch } = {}) {
    if (!(options.enabled ?? getEnv('BA_API_ENABLED') === 'true')) throw new SourceConfigurationError('BA synchronization is disabled until BA_API_ENABLED=true is configured.');
    this.endpoint = options.endpoint ?? getEnv('BA_API_URL') ?? '';
    this.apiKey = options.apiKey ?? getEnv('BA_API_KEY') ?? '';
    if (!this.endpoint) throw new SourceConfigurationError('BA_API_URL is required for BA source synchronization');
    if (!this.apiKey) throw new SourceConfigurationError('BA_API_KEY is required for BA source synchronization');
    this.detailEndpoint = options.detailEndpoint ?? getEnv('BA_DETAIL_API_URL') ?? detailApiUrl(this.endpoint);
    if (!this.detailEndpoint || this.detailEndpoint === this.endpoint) throw new SourceConfigurationError('BA_DETAIL_API_URL is required when it cannot be derived from BA_API_URL');
    this.pageSize = Math.min(Math.max(options.pageSize ?? PAGE_SIZE, 1), PAGE_SIZE);
    this.fetchDetails = options.fetchDetails ?? getEnv('BA_FETCH_DETAILS') !== 'false';
    this.detailConcurrency = Math.min(Math.max(options.detailConcurrency ?? Number(getEnv('BA_DETAIL_CONCURRENCY') || DETAIL_CONCURRENCY), 1), 10);
    this.fetcher = options.fetcher ?? fetch;
  }

  private async fetchDetail(record: BaJobRecord): Promise<BaJobRecord> {
    const reference = asString(record.refnr);
    if (!reference) return record;
    const url = `${this.detailEndpoint.replace(/\/$/, '')}/${encodeURIComponent(referenceToken(reference))}`;
    try {
      const response = await this.fetcher(url, { headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' } });
      if (!response.ok) return record;
      const detail = asRecord(await response.json()) as BaJobDetail | null;
      return detail && asString(detail.referenznummer) === reference ? { ...record, detail } : record;
    } catch {
      // A listing may disappear between search and detail requests. Keep the
      // searchable official record instead of failing the entire source page.
      return record;
    }
  }

  private async enrichDetails(records: BaJobRecord[]): Promise<BaJobRecord[]> {
    if (!this.fetchDetails || records.length === 0) return records;
    const enriched = new Array<BaJobRecord>(records.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < records.length) {
        const index = nextIndex;
        nextIndex += 1;
        enriched[index] = await this.fetchDetail(records[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.detailConcurrency, records.length) }, worker));
    return enriched;
  }

  async fetchPage(cursor: string | null): Promise<SourcePage<BaJobRecord>> {
    const pageNumber = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 1;
    const url = new URL(this.endpoint);
    url.searchParams.set('angebotsart', '4');
    url.searchParams.set('page', String(pageNumber));
    url.searchParams.set('size', String(this.pageSize));
    const response = await this.fetcher(url, { headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' } });
    if (!response.ok) throw new SourceFetchError(`BA jobs API returned HTTP ${response.status}`);
    let payload: unknown;
    try { payload = await response.json(); } catch (error) { throw new SourceFetchError('BA jobs API returned invalid JSON', { cause: error }); }
    const object = asRecord(payload) as BaSearchResponse | null;
    const searchRecords = Array.isArray(object?.stellenangebote)
      ? object.stellenangebote.filter((record): record is BaJobRecord => asRecord(record) !== null) as BaJobRecord[]
      : [];
    const total = integer(object?.maxErgebnisse);
    const responsePage = integer(object?.page);
    const responseSize = integer(object?.size);
    if (total === null || responsePage !== pageNumber || responseSize === null || responseSize < 1) {
      throw new SourcePaginationError('BA jobs API response is missing valid maxErgebnisse, page, or size metadata');
    }
    const records = await this.enrichDetails(searchRecords);
    const complete = total === 0 || pageNumber * responseSize >= total;
    return { records, nextCursor: complete ? null : String(pageNumber + 1), complete };
  }

  normalize(record: BaJobRecord): NormalizedSourceRecord | null {
    const refnr = asString(record.refnr);
    const mapped = refnr ? officialRecord(record) : null;
    if (!mapped) return null;
    const normalized = normalizeJob(mapped, { provider: this.provider, defaultCountry: 'Germany', defaultJobType: 'apprenticeship', defaultLevel: 'entry-level' });
    return normalized ? { ...normalized, rawRecord: record, job: { ...normalized.job, sourceName: 'Bundesagentur für Arbeit' } } : null;
  }
}

export const createBaAdapter = (options?: ConstructorParameters<typeof BaAdapter>[0]) => new BaAdapter(options);
