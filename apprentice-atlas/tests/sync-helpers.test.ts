import { describe, expect, it } from 'vitest';
import { jobInsertPayload, jobUpdatePayload, pageIsComplete, shouldExpireStaleListings, sourceUpsertPayload, syncRunInsertPayload } from '../supabase/functions/_shared/sync-helpers';

const item = {
  externalId: 'uk-123',
  sourceUrl: 'https://example.test/jobs/uk-123',
  rawRecord: { vacancyReference: 'uk-123' },
  job: {
    id: 'generated', title: 'Apprentice', company: 'Atlas', country: 'UK', city: 'London', latitude: 51, longitude: -0.1,
    jobType: 'apprenticeship', level: 'entry-level', category: 'general', tags: [], rawDescription: '', requirements: [],
    sourceUrl: 'https://example.test/jobs/uk-123', applicationUrl: null, sourceName: 'find-apprenticeship', status: 'active' as const,
    lastSeenAt: '2026-01-01T00:00:00.000Z', expiresAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('sync helpers', () => {
  it('only expires stale listings after a complete run', () => {
    expect(shouldExpireStaleListings(true)).toBe(true);
    expect(shouldExpireStaleListings(false)).toBe(false);
  });

  it('requires both a terminal page and null cursor for completion', () => {
    expect(pageIsComplete({ records: [], nextCursor: '2', complete: false })).toBe(false);
    expect(pageIsComplete({ records: [], nextCursor: null, complete: true })).toBe(true);
  });

  it('builds schema-safe sync run and upsert payloads', () => {
    expect(syncRunInsertPayload('find-apprenticeship', 'find-apprenticeship:default', '2026-01-01T00:00:00.000Z')).toEqual({ provider: 'find-apprenticeship', source_key: 'find-apprenticeship:default', source_provider: 'find-apprenticeship', status: 'running', started_at: '2026-01-01T00:00:00.000Z' });
    expect(jobInsertPayload(item, 'job-id', '2026-01-02T00:00:00.000Z')).toMatchObject({ id: 'job-id', created_at: item.job.createdAt, last_seen_at: '2026-01-02T00:00:00.000Z', source_url: item.sourceUrl });
    expect(jobUpdatePayload(item, '2026-01-02T00:00:00.000Z')).toMatchObject({ last_seen_at: '2026-01-02T00:00:00.000Z', source_url: item.sourceUrl });
    expect(jobUpdatePayload(item, '2026-01-02T00:00:00.000Z')).not.toHaveProperty('created_at');
    expect(sourceUpsertPayload(item, 'job-id', 'find-apprenticeship', '2026-01-02T00:00:00.000Z')).toEqual({ job_id: 'job-id', provider: 'find-apprenticeship', external_id: 'uk-123', source_url: item.sourceUrl, raw_payload: item.rawRecord, status: 'active', fetched_at: '2026-01-02T00:00:00.000Z' });
  });
});
