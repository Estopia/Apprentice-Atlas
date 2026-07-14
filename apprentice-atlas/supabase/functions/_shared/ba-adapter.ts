import { normalizeJob } from './normalize-job.ts';
import { asRecord, asString, getEnv, SourceConfigurationError, SourceFetchError, SourcePaginationError, type NormalizedSourceRecord, type SourceAdapter, type SourcePage, type SourceRecord } from './source-adapter.ts';

const PAGE_SIZE = 100;

export interface BaJobRecord extends SourceRecord {
  refnr?: string;
  titel?: string;
  arbeitgeber?: string;
  arbeitsort?: SourceRecord;
  externeUrl?: string | null;
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

const officialRecord = (record: BaJobRecord): SourceRecord | null => {
  const location = asRecord(record.arbeitsort);
  const coordinates = asRecord(location?.koordinaten);
  const country = asString(location?.land);
  if (country !== 'Deutschland') return null;
  return {
    ...record,
    externalId: asString(record.refnr),
    sourceUrl: jobDetailUrl(asString(record.refnr)!),
    applicationUrl: asString(record.externeUrl),
    title: asString(record.titel),
    company: asString(record.arbeitgeber),
    city: asString(location?.ort),
    country: 'Germany',
    latitude: coordinates?.lat,
    longitude: coordinates?.lon,
    category: asString(record.beruf),
  };
};

export class BaAdapter implements SourceAdapter<BaJobRecord> {
  readonly provider = 'bundesagentur-fuer-arbeit';
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly pageSize: number;
  private readonly fetcher: typeof fetch;

  constructor(options: { enabled?: boolean; endpoint?: string; apiKey?: string; pageSize?: number; fetcher?: typeof fetch } = {}) {
    if (!(options.enabled ?? getEnv('BA_API_ENABLED') === 'true')) throw new SourceConfigurationError('BA synchronization is disabled until BA_API_ENABLED=true is configured.');
    this.endpoint = options.endpoint ?? getEnv('BA_API_URL') ?? '';
    this.apiKey = options.apiKey ?? getEnv('BA_API_KEY') ?? '';
    if (!this.endpoint) throw new SourceConfigurationError('BA_API_URL is required for BA source synchronization');
    if (!this.apiKey) throw new SourceConfigurationError('BA_API_KEY is required for BA source synchronization');
    this.pageSize = Math.min(Math.max(options.pageSize ?? PAGE_SIZE, 1), PAGE_SIZE);
    this.fetcher = options.fetcher ?? fetch;
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
    const records = Array.isArray(object?.stellenangebote)
      ? object.stellenangebote.filter((record): record is BaJobRecord => asRecord(record) !== null) as BaJobRecord[]
      : [];
    const total = integer(object?.maxErgebnisse);
    const responsePage = integer(object?.page);
    const responseSize = integer(object?.size);
    if (total === null || responsePage !== pageNumber || responseSize === null || responseSize < 1) {
      throw new SourcePaginationError('BA jobs API response is missing valid maxErgebnisse, page, or size metadata');
    }
    const complete = total === 0 || pageNumber * responseSize >= total;
    return { records, nextCursor: complete ? null : String(pageNumber + 1), complete };
  }

  normalize(record: BaJobRecord): NormalizedSourceRecord | null {
    const refnr = asString(record.refnr);
    const mapped = refnr ? officialRecord(record) : null;
    if (!mapped) return null;
    const normalized = normalizeJob(mapped, { provider: this.provider, defaultCountry: 'Germany', defaultJobType: 'apprenticeship', defaultLevel: 'entry-level' });
    return normalized ? { ...normalized, rawRecord: record } : null;
  }
}

export const createBaAdapter = (options?: ConstructorParameters<typeof BaAdapter>[0]) => new BaAdapter(options);
