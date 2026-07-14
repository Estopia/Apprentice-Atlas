import { describe, expect, it } from 'vitest';
import { isSyncRequestAuthorized } from '../supabase/functions/_shared/sync-auth';
import { runSync, type SyncRepository, type SyncRunCompletion, type SyncRunFailure } from '../supabase/functions/_shared/sync-runner';
import type { NormalizedSourceRecord, SourceAdapter, SourceRecord } from '../supabase/functions/_shared/source-adapter';
import { UkApprenticeshipAdapter } from '../supabase/functions/_shared/uk-apprenticeship-adapter';

const makeItem = (externalId: string, createdAt = '2026-01-01T00:00:00.000Z'): NormalizedSourceRecord => ({
  externalId,
  sourceUrl: `https://example.test/jobs/${externalId}`,
  rawRecord: { vacancyReference: externalId },
  job: {
    id: `generated-${externalId}`, title: `Apprentice ${externalId}`, company: 'Atlas', country: 'UK', city: 'London', latitude: 51, longitude: -0.1,
    jobType: 'apprenticeship', level: 'entry-level', category: 'general', tags: [], rawDescription: '', requirements: [], sourceUrl: `https://example.test/jobs/${externalId}`, applicationUrl: null, sourceName: 'find-apprenticeship', status: 'active',
    lastSeenAt: createdAt, expiresAt: null, createdAt, updatedAt: createdAt,
  },
});

class MockRepository implements SyncRepository {
  readonly runs: Array<{ id: string; status: string; payload: unknown }> = [];
  readonly jobs = new Map<string, Record<string, unknown>>();
  readonly sources = new Map<string, Record<string, unknown>>();
  readonly operations: string[] = [];
  private runNumber = 0;

  async startRun(payload: { provider: string; source_key: string; source_provider: string; status: 'running'; started_at: string }) {
    const id = `run-${++this.runNumber}`;
    this.runs.push({ id, status: 'running', payload });
    this.operations.push(`run:start:${id}`);
    return { id };
  }

  async upsertJobSource(item: NormalizedSourceRecord, provider: string, fetchedAt: string) {
    const key = `${provider}:${item.externalId}`;
    const existing = this.sources.get(key);
    const jobId = existing?.job_id ? String(existing.job_id) : item.job.id;
    if (existing) {
      this.operations.push(`job:update:${jobId}`);
      const update: Record<string, unknown> = {
        id: jobId, title: item.job.title, company: item.job.company, country: item.job.country, city: item.job.city,
        latitude: item.job.latitude, longitude: item.job.longitude, source_name: item.job.sourceName, status: item.job.status,
        last_seen_at: fetchedAt, updated_at: fetchedAt,
      };
      this.jobs.set(jobId, { ...this.jobs.get(jobId), ...update });
    } else {
      this.operations.push(`job:insert:${jobId}`);
      this.jobs.set(jobId, { id: jobId, created_at: item.job.createdAt, source_name: item.job.sourceName, status: item.job.status, last_seen_at: fetchedAt, updated_at: fetchedAt });
    }
    this.operations.push(`source:upsert:${item.externalId}`);
    this.sources.set(key, { job_id: jobId, provider, external_id: item.externalId, status: 'active', fetched_at: fetchedAt });
    return { jobId, inserted: !existing };
  }

  async expireStaleListings(provider: string, seenBefore: string) {
    let expired = 0;
    for (const source of this.sources.values()) {
      if (source.provider === provider && source.status === 'active' && String(source.fetched_at) < seenBefore) source.status = 'retired';
    }
    for (const job of this.jobs.values()) {
      if (job.source_name === provider && job.status === 'active' && String(job.last_seen_at) < seenBefore) {
        job.status = 'expired';
        job.updated_at = seenBefore;
        expired += 1;
      }
    }
    this.operations.push(`expire:${expired}`);
    return expired;
  }

  async finishRun(runId: string, payload: SyncRunCompletion) {
    const run = this.runs.find((candidate) => candidate.id === runId)!;
    run.status = String(payload.status);
    run.payload = payload;
    this.operations.push(`run:finish:${runId}`);
  }

  async failRun(runId: string, payload: SyncRunFailure) {
    const run = this.runs.find((candidate) => candidate.id === runId)!;
    run.status = 'failed';
    run.payload = payload;
    this.operations.push(`run:fail:${runId}`);
  }
}

function adapterFromIds(pages: Array<{ ids: string[]; nextCursor: string | null; complete: boolean }>): SourceAdapter {
  return {
    provider: 'find-apprenticeship',
    async fetchPage(cursor) {
      const page = pages[cursor ? Number(cursor) : 0];
      return { records: page.ids.map((id) => ({ id })), nextCursor: page.nextCursor, complete: page.complete };
    },
    normalize(record) {
      return makeItem(String(record.id));
    },
  };
}

describe('sync-jobs lifecycle with a mocked repository', () => {
  it('iterates pages, records start/success, upserts sources/jobs, and preserves created_at on repeat sync', async () => {
    const repository = new MockRepository();
    const firstPages = [{ ids: ['a', 'b'], nextCursor: '1', complete: false }, { ids: ['c'], nextCursor: null, complete: true }];
    const clock = { value: '2026-01-01T00:00:00.000Z' };
    await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds(firstPages), repository, startedAt: clock.value, finishedAt: () => clock.value, pageDelayMs: 0 });
    clock.value = '2026-01-02T00:00:00.000Z';
    await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds([{ ids: ['a'], nextCursor: null, complete: true }]), repository, startedAt: clock.value, finishedAt: () => clock.value, pageDelayMs: 0 });
    expect(repository.runs.map((run) => run.status)).toEqual(['succeeded', 'succeeded']);
    expect(repository.runs[0].payload).toMatchObject({ fetched_count: 3, inserted_count: 3, expired_count: 0 });
    expect(repository.sources.has('find-apprenticeship:c')).toBe(true);
    expect(repository.sources.get('find-apprenticeship:a')?.status).toBe('active');
    expect(repository.sources.get('find-apprenticeship:b')?.status).toBe('retired');
    expect(repository.jobs.get('generated-a')?.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(repository.jobs.get('generated-a')?.updated_at).toBe('2026-01-02T00:00:00.000Z');
    expect(repository.operations).toContain('job:update:generated-a');
    expect(repository.operations).toContain('expire:2');
    expect(repository.operations).toContain('run:finish:run-2');
  });

  it('preserves stale listings when the page bound makes the run incomplete', async () => {
    const repository = new MockRepository();
    await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds([{ ids: ['old'], nextCursor: null, complete: true }]), repository, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: () => '2026-01-01T00:00:00.000Z', pageDelayMs: 0 });
    const result = await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds([{ ids: ['new'], nextCursor: '1', complete: false }, { ids: ['never-reached'], nextCursor: null, complete: true }]), repository, startedAt: '2026-01-02T00:00:00.000Z', finishedAt: () => '2026-01-02T00:00:00.000Z', maxPages: 1, pageDelayMs: 0 });
    expect(repository.runs[1].status).toBe('partial');
    expect(result.status).toBe('partial');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('PAGE_BOUND_REACHED');
    expect(result.error_count).toBe(result.errors.length);
    expect(repository.runs[1].payload).toMatchObject({ error_count: result.errors.length, error_details: result.errors });
    expect(repository.jobs.get('generated-old')?.status).toBe('active');
    expect(repository.operations.filter((operation) => operation.startsWith('expire:'))).toHaveLength(1);
  });

  it('expires stale listings after a valid completed empty sync', async () => {
    const repository = new MockRepository();
    await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds([{ ids: ['old'], nextCursor: null, complete: true }]), repository, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: () => '2026-01-01T00:00:00.000Z', pageDelayMs: 0 });
    const emptyAdapter = adapterFromIds([{ ids: [], nextCursor: null, complete: true }]);
    const result = await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: emptyAdapter, repository, startedAt: '2026-01-02T00:00:00.000Z', finishedAt: () => '2026-01-02T00:00:00.000Z', pageDelayMs: 0 });
    expect(result.status).toBe('succeeded');
    expect(result.fetched_count).toBe(0);
    expect(result.expired_count).toBe(1);
    expect(repository.jobs.get('generated-old')?.status).toBe('expired');
  });

  it('records sync error and does not expire on adapter failure', async () => {
    const repository = new MockRepository();
    await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds([{ ids: ['old'], nextCursor: null, complete: true }]), repository, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: () => '2026-01-01T00:00:00.000Z', pageDelayMs: 0 });
    const adapter: SourceAdapter = { provider: 'find-apprenticeship', fetchPage: async () => { throw new Error('mock fetch failed'); }, normalize: () => null };
    const expirationOperationsBeforeFailure = repository.operations.filter((operation) => operation.startsWith('expire:')).length;
    await expect(runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter, repository, startedAt: '2026-01-02T00:00:00.000Z', pageDelayMs: 0 })).rejects.toThrow('mock fetch failed');
    expect(repository.runs[1].status).toBe('failed');
    expect(repository.jobs.get('generated-old')?.status).toBe('active');
    expect(repository.operations).toContain('run:fail:run-2');
    expect(repository.operations.filter((operation) => operation.startsWith('expire:')).length).toBe(expirationOperationsBeforeFailure);
  });

  it('keeps earlier per-listing commits when a later page fails', async () => {
    const repository = new MockRepository();
    let page = 0;
    const adapter: SourceAdapter = {
      provider: 'find-apprenticeship',
      fetchPage: async () => {
        if (page++ === 0) return { records: [{ id: 'committed-first' }], nextCursor: '1', complete: false };
        throw new Error('later page failed');
      },
      normalize(record) { return makeItem(String(record.id)); },
    };
    await expect(runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter, repository, startedAt: '2026-01-02T00:00:00.000Z', pageDelayMs: 0 })).rejects.toThrow('later page failed');
    expect(repository.sources.has('find-apprenticeship:committed-first')).toBe(true);
    expect(repository.jobs.has('generated-committed-first')).toBe(true);
    expect(repository.runs[0].status).toBe('failed');
    expect(repository.operations.some((operation) => operation.startsWith('expire:'))).toBe(false);
  });

  it('fails malformed UK pagination before expiration', async () => {
    const repository = new MockRepository();
    await runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter: adapterFromIds([{ ids: ['old'], nextCursor: null, complete: true }]), repository, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: () => '2026-01-01T00:00:00.000Z', pageDelayMs: 0 });
    const adapter = new UkApprenticeshipAdapter({ apiKey: 'secret', fetcher: async () => new Response(JSON.stringify({ vacancies: [] }), { status: 200 }) });
    await expect(runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter, repository, startedAt: '2026-01-02T00:00:00.000Z', pageDelayMs: 0 })).rejects.toMatchObject({ code: 'SOURCE_PAGINATION_ERROR' });
    expect(repository.jobs.get('generated-old')?.status).toBe('active');
    expect(repository.runs[1].status).toBe('failed');
  });

  it('atomically converges concurrent repeats to one canonical job and source', async () => {
    const repository = new MockRepository();
    const adapter = adapterFromIds([{ ids: ['same'], nextCursor: null, complete: true }]);
    await Promise.all([
      runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter, repository, startedAt: '2026-01-01T00:00:00.000Z', pageDelayMs: 0 }),
      runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter, repository, startedAt: '2026-01-01T00:00:01.000Z', pageDelayMs: 0 }),
    ]);
    expect(repository.jobs.size).toBe(1);
    expect(repository.sources.size).toBe(1);
    expect(repository.operations.filter((operation) => operation.startsWith('job:insert:'))).toHaveLength(1);
    expect(repository.operations.filter((operation) => operation.startsWith('job:update:'))).toHaveLength(1);
  });

  it('returns a meaningful failure when marking a run failed also fails', async () => {
    const repository = new MockRepository();
    repository.failRun = async () => { throw new Error('database update failed'); };
    const adapter: SourceAdapter = { provider: 'find-apprenticeship', fetchPage: async () => { throw new Error('source failed'); }, normalize: () => null };
    await expect(runSync({ provider: 'find-apprenticeship', sourceKey: 'find-apprenticeship:default', adapter, repository, startedAt: '2026-01-01T00:00:00.000Z', pageDelayMs: 0 })).rejects.toMatchObject({ code: 'SYNC_RUN_FAILURE', message: expect.stringContaining('database update failed') });
  });
});

describe('sync provider authorization', () => {
  it('requires the internal secret or service-role authorization', () => {
    expect(isSyncRequestAuthorized(new Request('https://example.test', { method: 'POST' }), { internalSecret: 'secret', serviceRoleKey: 'service' })).toBe(false);
    expect(isSyncRequestAuthorized(new Request('https://example.test', { method: 'POST', headers: { 'x-sync-internal-secret': 'secret' } }), { internalSecret: 'secret' })).toBe(true);
    expect(isSyncRequestAuthorized(new Request('https://example.test', { method: 'POST', headers: { authorization: 'Bearer service' } }), { serviceRoleKey: 'service' })).toBe(true);
  });
});
