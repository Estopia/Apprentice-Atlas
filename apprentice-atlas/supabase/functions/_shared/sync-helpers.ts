import type { NormalizedSourceRecord, SourcePage } from './source-adapter.ts';

export function pageIsComplete<T>(page: SourcePage<T>): boolean {
  return page.complete && page.nextCursor === null;
}

export function shouldExpireStaleListings(runComplete: boolean): boolean {
  return runComplete;
}

export function syncRunInsertPayload(provider: string, sourceKey: string, startedAt: string) {
  return { provider, source_key: sourceKey, source_provider: provider, status: 'running' as const, started_at: startedAt };
}

export function jobInsertPayload(item: NormalizedSourceRecord, jobId: string, seenAt: string) {
  const job = item.job;
  return { id: jobId, title: job.title, company: job.company, country: job.country, city: job.city, latitude: job.latitude, longitude: job.longitude, job_type: job.jobType, level: job.level, category: job.category, tags: job.tags, raw_description: job.rawDescription, requirements: job.requirements, source_url: job.sourceUrl, source_name: job.sourceName, status: job.status, last_seen_at: seenAt, expires_at: job.expiresAt, created_at: job.createdAt, updated_at: seenAt };
}

export function jobUpdatePayload(item: NormalizedSourceRecord, seenAt: string) {
  const job = item.job;
  return { title: job.title, company: job.company, country: job.country, city: job.city, latitude: job.latitude, longitude: job.longitude, job_type: job.jobType, level: job.level, category: job.category, tags: job.tags, raw_description: job.rawDescription, requirements: job.requirements, source_url: job.sourceUrl, source_name: job.sourceName, status: job.status, last_seen_at: seenAt, expires_at: job.expiresAt, updated_at: seenAt };
}

export function sourceUpsertPayload(item: NormalizedSourceRecord, jobId: string, provider: string, fetchedAt: string) {
  return { job_id: jobId, provider, external_id: item.externalId, source_url: item.sourceUrl, raw_payload: item.rawRecord, status: 'active' as const, fetched_at: fetchedAt };
}
