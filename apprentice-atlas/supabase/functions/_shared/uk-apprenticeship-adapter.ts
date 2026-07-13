import { normalizeJob } from './normalize-job.ts';
import { extractNextCursor, extractRecords, firstString, getEnv, SourceConfigurationError, SourceFetchError, type SourceAdapter, type SourceRecord, type SourcePage, type NormalizedSourceRecord } from './source-adapter.ts';

export interface UkApprenticeshipRecord extends SourceRecord {}

export class UkApprenticeshipAdapter implements SourceAdapter<UkApprenticeshipRecord> {
  readonly provider = 'find-apprenticeship';
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly pageSize: number;
  private readonly fetcher: typeof fetch;

  constructor(options: { endpoint?: string; apiKey?: string; pageSize?: number; fetcher?: typeof fetch } = {}) {
    this.endpoint = options.endpoint ?? getEnv('UK_APPRENTICESHIPS_API_URL') ?? 'https://api.apprenticeships.education.gov.uk/vacancies';
    this.apiKey = options.apiKey ?? getEnv('UK_APPRENTICESHIPS_API_KEY') ?? getEnv('UK_APRENTICESHIPS_API_KEY') ?? '';
    this.pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
    this.fetcher = options.fetcher ?? fetch;
  }

  async fetchPage(cursor: string | null): Promise<SourcePage<UkApprenticeshipRecord>> {
    if (!this.apiKey) throw new SourceConfigurationError('UK_APPRENTICESHIPS_API_KEY is required for UK source synchronization');
    const url = new URL(this.endpoint);
    url.searchParams.set('pageSize', String(this.pageSize));
    if (cursor) url.searchParams.set(/^\d+$/.test(cursor) ? 'page' : 'cursor', cursor);
    const response = await this.fetcher(url, {
      headers: { 'Ocp-Apim-Subscription-Key': this.apiKey, 'X-Version': '2', Accept: 'application/json' },
    });
    if (!response.ok) throw new SourceFetchError(`UK apprenticeship API returned HTTP ${response.status}`);
    let payload: unknown;
    try { payload = await response.json(); } catch (error) { throw new SourceFetchError('UK apprenticeship API returned invalid JSON', { cause: error }); }
    const records = extractRecords(payload) as UkApprenticeshipRecord[];
    const nextCursor = extractNextCursor(payload, cursor);
    return { records, nextCursor, complete: nextCursor === null };
  }

  normalize(record: UkApprenticeshipRecord): NormalizedSourceRecord | null {
    const normalized = normalizeJob(record, { provider: this.provider, defaultCountry: 'United Kingdom' });
    if (!normalized) return null;
    const officialId = firstString(record, ['vacancyReferenceNumber', 'vacancyId', 'id', 'externalId']);
    const officialUrl = firstString(record, ['applicationUri', 'vacancyUrl', 'url', 'sourceUrl']);
    return officialId && officialUrl ? { ...normalized, externalId: officialId, sourceUrl: officialUrl, job: { ...normalized.job, sourceUrl: officialUrl } } : null;
  }
}

export const createUkApprenticeshipAdapter = (options?: ConstructorParameters<typeof UkApprenticeshipAdapter>[0]) => new UkApprenticeshipAdapter(options);
