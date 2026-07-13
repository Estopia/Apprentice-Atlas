import { dedupeByExternalId, type NormalizedSourceRecord, type SourceAdapter } from './source-adapter.ts';
import { jobInsertPayload, jobUpdatePayload, sourceUpsertPayload, syncRunInsertPayload } from './sync-helpers.ts';

export interface SyncRepository {
  startRun(payload: ReturnType<typeof syncRunInsertPayload>): Promise<{ id: string }>;
  findSource(provider: string, externalId: string): Promise<{ jobId: string | null } | null>;
  insertJob(payload: ReturnType<typeof jobInsertPayload>): Promise<void>;
  updateJob(jobId: string, payload: ReturnType<typeof jobUpdatePayload>): Promise<void>;
  upsertSource(payload: ReturnType<typeof sourceUpsertPayload>): Promise<void>;
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
    for (let page = 0; page < maxPages; page += 1) {
      const result = await options.adapter.fetchPage(cursor);
      counts.fetched_count += result.records.length;
      const normalized = dedupeByExternalId(result.records.map((record) => options.adapter.normalize(record)).filter((record): record is NormalizedSourceRecord => record !== null));
      for (const item of normalized) {
        const existing = await options.repository.findSource(options.provider, item.externalId);
        const jobId = existing?.jobId ?? item.job.id;
        if (existing?.jobId) {
          await options.repository.updateJob(jobId, jobUpdatePayload(item, startedAt));
          counts.updated_count += 1;
        } else {
          await options.repository.insertJob(jobInsertPayload(item, jobId, startedAt));
          counts.inserted_count += 1;
        }
        await options.repository.upsertSource(sourceUpsertPayload(item, jobId, options.provider, startedAt));
      }
      cursor = result.nextCursor;
      complete = result.complete && cursor === null;
      if (complete) break;
      if (options.pageDelayMs) await new Promise((resolve) => setTimeout(resolve, options.pageDelayMs));
    }
    if (!complete) errors.push({ code: 'PAGE_BOUND_REACHED', message: `Stopped after ${maxPages} pages before the source reported completion` });
    if (complete) counts.expired_count = await options.repository.expireStaleListings(options.provider, startedAt);
    await options.repository.finishRun(run.id, { ...counts, status: errors.length ? 'partial' : 'succeeded', error_count: errors.length, error_details: errors.length ? errors : null, finished_at: finishedAt() });
    return { provider: options.provider, status: errors.length ? 'partial' as const : 'succeeded' as const, ...counts, errors };
  } catch (error) {
    const details = [{ code: 'SYNC_ERROR', message: error instanceof Error ? error.message : String(error) }];
    await options.repository.failRun(run.id, { ...counts, error_count: counts.error_count + 1, error_details: details, finished_at: finishedAt() });
    throw error;
  }
}
