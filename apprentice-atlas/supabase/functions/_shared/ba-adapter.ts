import { normalizeJob } from './normalize-job.ts';
import { extractNextCursor, extractRecords, getEnv, SourceConfigurationError, SourceFetchError, type SourceAdapter, type SourcePage, type SourceRecord, type NormalizedSourceRecord } from './source-adapter.ts';

export class BaAdapter implements SourceAdapter {
  readonly provider = 'bundesagentur-fuer-arbeit';
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(options: { endpoint?: string; apiKey?: string; fetcher?: typeof fetch } = {}) {
    this.endpoint = options.endpoint ?? getEnv('BA_JOBS_API_URL') ?? '';
    this.apiKey = options.apiKey ?? getEnv('BA_JOBS_API_KEY') ?? '';
    this.fetcher = options.fetcher ?? fetch;
  }

  async fetchPage(cursor: string | null): Promise<SourcePage<SourceRecord>> {
    if (!this.endpoint || !this.apiKey) {
      throw new SourceConfigurationError('BA_JOBS_API_URL and BA_JOBS_API_KEY are required; the official BA read contract is not configured');
    }
    const url = new URL(this.endpoint);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await this.fetcher(url, { headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' } });
    if (!response.ok) throw new SourceFetchError(`BA jobs API returned HTTP ${response.status}`);
    let payload: unknown;
    try { payload = await response.json(); } catch (error) { throw new SourceFetchError('BA jobs API returned invalid JSON', { cause: error }); }
    const records = extractRecords(payload);
    const nextCursor = extractNextCursor(payload, cursor);
    return { records, nextCursor, complete: nextCursor === null };
  }

  normalize(record: SourceRecord): NormalizedSourceRecord | null {
    const normalized = normalizeJob(record, { provider: this.provider, defaultCountry: 'Germany' });
    return normalized;
  }
}

