import { normalizeJob } from './normalize-job.ts';
import { extractRecords, firstString, getEnv, SourceConfigurationError, SourceFetchError, type SourceAdapter, type SourceRecord, type SourcePage, type NormalizedSourceRecord } from './source-adapter.ts';

export interface UkApprenticeshipRecord extends SourceRecord {}

export class UkApprenticeshipAdapter implements SourceAdapter<UkApprenticeshipRecord> {
  readonly provider = 'find-apprenticeship';
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly pageSize: number;
  private readonly fetcher: typeof fetch;

  constructor(options: { endpoint?: string; apiKey?: string; pageSize?: number; fetcher?: typeof fetch } = {}) {
    this.endpoint = options.endpoint ?? getEnv('UK_APPRENTICESHIPS_API_URL') ?? 'https://api.apprenticeships.education.gov.uk/vacancies/vacancy';
    this.apiKey = options.apiKey ?? getEnv('UK_APPRENTICESHIPS_API_KEY') ?? getEnv('UK_APRENTICESHIPS_API_KEY') ?? '';
    this.pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
    this.fetcher = options.fetcher ?? fetch;
  }

  async fetchPage(cursor: string | null): Promise<SourcePage<UkApprenticeshipRecord>> {
    if (!this.apiKey) throw new SourceConfigurationError('UK_APPRENTICESHIPS_API_KEY is required for UK source synchronization');
    const url = new URL(this.endpoint);
    const pageNumber = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 1;
    url.searchParams.set('PageNumber', String(pageNumber));
    url.searchParams.set('PageSize', String(this.pageSize));
    const response = await this.fetcher(url, {
      headers: { 'Ocp-Apim-Subscription-Key': this.apiKey, 'X-Version': '2', Accept: 'application/json' },
    });
    if (!response.ok) throw new SourceFetchError(`UK apprenticeship API returned HTTP ${response.status}`);
    let payload: unknown;
    try { payload = await response.json(); } catch (error) { throw new SourceFetchError('UK apprenticeship API returned invalid JSON', { cause: error }); }
    const records = extractRecords(payload) as UkApprenticeshipRecord[];
    const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as SourceRecord : {};
    const totalPages = Number(payloadObject.totalPages ?? (payloadObject.pagination as SourceRecord | undefined)?.totalPages);
    const nextCursor = Number.isInteger(totalPages) && totalPages >= pageNumber && pageNumber < totalPages ? String(pageNumber + 1) : null;
    return { records, nextCursor, complete: nextCursor === null };
  }

  normalize(record: UkApprenticeshipRecord): NormalizedSourceRecord | null {
    const normalized = normalizeJob(record, { provider: this.provider, defaultCountry: 'United Kingdom' });
    if (!normalized) return null;
    const officialId = firstString(record, ['vacancyReference', 'vacancyReferenceNumber', 'vacancyId', 'id', 'externalId']);
    const officialUrl = firstString(record, ['applicationUrl', 'applicationUri', 'vacancyUrl', 'url', 'sourceUrl']);
    return officialId && officialUrl ? { ...normalized, externalId: officialId, sourceUrl: officialUrl, job: { ...normalized.job, sourceUrl: officialUrl } } : null;
  }
}

export const createUkApprenticeshipAdapter = (options?: ConstructorParameters<typeof UkApprenticeshipAdapter>[0]) => new UkApprenticeshipAdapter(options);
