import { normalizeJob } from './normalize-job.ts';
import { asRecord, asString, extractRecords, firstString, getEnv, SourceConfigurationError, SourceFetchError, SourcePaginationError, type SourceAdapter, type SourceRecord, type SourcePage, type NormalizedSourceRecord } from './source-adapter.ts';

export const UK_OFFICIAL_CONTRACT_UNCONFIRMED = 'UK_OFFICIAL_CONTRACT_UNCONFIRMED';

export interface UkApprenticeshipRecord extends SourceRecord {}

export class UkApprenticeshipAdapter implements SourceAdapter<UkApprenticeshipRecord> {
  readonly provider = 'find-apprenticeship';
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly pageSize: number;
  private readonly fetcher: typeof fetch;

  constructor(options: { endpoint?: string; apiKey?: string; pageSize?: number; fetcher?: typeof fetch; contractConfirmed?: boolean } = {}) {
    const contractConfirmed = options.contractConfirmed ?? getEnv('UK_API_CONTRACT_CONFIRMED') === 'true';
    if (!contractConfirmed) throw new SourceConfigurationError('UK synchronization is disabled until the official Display Advert API v2 contract is explicitly confirmed (set UK_API_CONTRACT_CONFIRMED=true).', UK_OFFICIAL_CONTRACT_UNCONFIRMED);
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
    const rawTotalPages = payloadObject.totalPages ?? (payloadObject.pagination as SourceRecord | undefined)?.totalPages;
    const totalPages = typeof rawTotalPages === 'number' ? rawTotalPages : typeof rawTotalPages === 'string' && /^\d+$/.test(rawTotalPages.trim()) ? Number(rawTotalPages) : NaN;
    if (!Number.isInteger(totalPages) || totalPages < 0 || (totalPages === 0 && (pageNumber !== 1 || records.length > 0)) || (totalPages > 0 && pageNumber > totalPages)) throw new SourcePaginationError('UK apprenticeship API response is missing valid totalPages metadata');
    if (totalPages === 0) return { records: [], nextCursor: null, complete: true };
    const complete = pageNumber === totalPages;
    return { records, nextCursor: complete ? null : String(pageNumber + 1), complete };
  }

  normalize(record: UkApprenticeshipRecord): NormalizedSourceRecord | null {
    const firstAddress = Array.isArray(record.addresses) ? asRecord(record.addresses[0]) : null;
    const course = asRecord(record.course);
    const city = firstAddress ? firstString(firstAddress, ['addressLine3', 'addressLine2', 'addressLine4', 'postcode']) : null;
    const courseTitle = course ? firstString(course, ['title']) : null;
    const route = course ? firstString(course, ['route']) : null;
    const apprenticeshipLevel = asString(record.apprenticeshipLevel);
    const category = canonicalCategory(route ?? courseTitle ?? '');
    const enriched: UkApprenticeshipRecord = {
      ...record,
      city: city ?? record.city,
      jobType: 'apprenticeship',
      level: 'entry',
      category,
      tags: [route, courseTitle, apprenticeshipLevel].filter((item): item is string => Boolean(item)),
    };
    const normalized = normalizeJob(enriched, { provider: this.provider, defaultCountry: 'United Kingdom', defaultJobType: 'apprenticeship', defaultLevel: 'entry' });
    if (!normalized) return null;
    const officialId = firstString(record, ['vacancyReference', 'vacancyReferenceNumber', 'vacancyId', 'id', 'externalId']);
    const officialUrl = firstString(record, ['vacancyUrl', 'sourceUrl', 'source_url']);
    return officialId && officialUrl ? { ...normalized, externalId: officialId, sourceUrl: officialUrl, rawRecord: record, job: { ...normalized.job, sourceUrl: officialUrl, sourceName: 'Find an apprenticeship' } } : null;
  }
}

function canonicalCategory(value: string): string {
  const normalized = value.toLocaleLowerCase('en');
  if (/digital|technology|comput|software|data/.test(normalized)) return 'technology';
  if (/business|administration|sales|marketing|finance|account|legal|management/.test(normalized)) return 'business';
  if (/construction|engineering|manufactur|transport|logistics|agriculture|environment|trade/.test(normalized)) return 'skilled-trades';
  return 'general';
}

export const createUkApprenticeshipAdapter = (options?: ConstructorParameters<typeof UkApprenticeshipAdapter>[0]) => new UkApprenticeshipAdapter(options);
