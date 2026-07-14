import { dedupeByExternalId, type NormalizedSourceRecord, type SourceAdapter } from './source-adapter.ts';
import { syncRunInsertPayload } from './sync-helpers.ts';

export interface SyncRepository {
  startRun(payload: ReturnType<typeof syncRunInsertPayload>): Promise<{ id: string }>;
  upsertJobSource(item: NormalizedSourceRecord, provider: string, fetchedAt: string): Promise<{ inserted: boolean; jobId: string }>;
  expireStaleListings(provider: string, seenBefore: string): Promise<number>;
  finishRun(runId: string, payload: SyncRunCompletion): Promise<void>;
  failRun(runId: string, payload: SyncRunFailure): Promise<void>;
}

export interface SyncRunCompletion {
  status: 'succeeded' | 'partial';
  fetched_count: number;
  inserted_count: number;
  updated_count: number;
  expired_count: number;
  error_count: number;
  error_details: Array<{ code: string; message: string }> | null;
  finished_at: string;
}

export interface SyncRunFailure {
  fetched_count: number;
  inserted_count: number;
  updated_count: number;
  expired_count: number;
  error_count: number;
  error_details: Array<{ code: string; message: string }>;
  finished_at: string;
}

export class SyncRunFailureError extends Error {
  readonly code = 'SYNC_RUN_FAILURE';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SyncRunFailureError';
  }
}

export interface SyncRunnerOptions {
  provider: string;
  sourceKey: string;
  adapter: SourceAdapter;
  repository: SyncRepository;
  startedAt?: string;
  finishedAt?: () => string;
  maxPages?: number;
  pageDelayMs?: number;
}

export async function runSync(options: SyncRunnerOptions) {
  const startedAt = options.startedAt ?? new Date().toISOString();
  const finishedAt = options.finishedAt ?? (() => new Date().toISOString());
  const maxPages = Math.min(Math.max(options.maxPages ?? 20, 1), 100);
  const run = await options.repository.startRun(syncRunInsertPayload(options.provider, options.sourceKey, startedAt));
  const counts = { fetched_count: 0, inserted_count: 0, updated_count: 0, expired_count: 0, error_count: 0 };
  const errors: Array<{ code: string; message: string }> = [];
  let cursor: string | null = null;
  let complete = false;
  try {
    // Atomicity is per listing/source claim, not whole-run: successful prior
    // claims remain committed if a later page or item fails.
    for (let page = 0; page < maxPages; page += 1) {
      const result = await options.adapter.fetchPage(cursor);
      counts.fetched_count += result.records.length;
      const normalized = dedupeByExternalId(result.records.map((record) => options.adapter.normalize(record)).filter((record): record is NormalizedSourceRecord => record !== null));
      for (const item of normalized) {
        const result = await options.repository.upsertJobSource(item, options.provider, startedAt);
        if (result.inserted) counts.inserted_count += 1;
        else counts.updated_count += 1;
      }
      cursor = result.nextCursor;
      complete = result.complete && cursor === null;
      if (complete) break;
      if (options.pageDelayMs) await new Promise((resolve) => setTimeout(resolve, options.pageDelayMs));
    }
    if (!complete) errors.push({ code: 'PAGE_BOUND_REACHED', message: `Stopped after ${maxPages} pages before the source reported completion` });
    // Expiration is reached only by a complete run and is itself one RPC
    // transaction across source retirement and related job expiration.
    if (complete) counts.expired_count = await options.repository.expireStaleListings(options.provider, startedAt);
    counts.error_count = errors.length;
    const status = errors.length ? ('partial' as const) : ('succeeded' as const);
    await options.repository.finishRun(run.id, { ...counts, status, error_details: errors.length ? errors : null, finished_at: finishedAt() });
    return { provider: options.provider, status, ...counts, errors };
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'SYNC_ERROR';
    const details = [{ code: errorCode, message: error instanceof Error ? error.message : String(error) }];
    try {
      await options.repository.failRun(run.id, { ...counts, error_count: counts.error_count + 1, error_details: details, finished_at: finishedAt() });
    } catch (failureError) {
      console.error('Unable to mark sync run failed', { runId: run.id, error: failureError });
      throw new SyncRunFailureError(`Sync failed and run ${run.id} could not be marked failed: ${failureError instanceof Error ? failureError.message : String(failureError)}`, { cause: failureError });
    }
    throw error;
  }
}
