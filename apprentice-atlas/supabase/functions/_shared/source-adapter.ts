export interface SourcePage<T> {
  records: T[];
  nextCursor: string | null;
  complete: boolean;
}

declare const Deno: { env: { get(name: string): string | undefined } } | undefined;

export interface SourceRecord {
  [key: string]: unknown;
}

export interface NormalizedSourceRecord {
  externalId: string;
  sourceUrl: string;
  job: import('./normalize-job.ts').CanonicalJob;
  rawRecord: SourceRecord;
}

export interface SourceAdapter<TRecord extends SourceRecord = SourceRecord> {
  readonly provider: string;
  fetchPage(cursor: string | null): Promise<SourcePage<TRecord>>;
  normalize(record: TRecord): NormalizedSourceRecord | null;
}

export class SourceConfigurationError extends Error {
  readonly code = 'SOURCE_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'SourceConfigurationError';
  }
}

export class SourceFetchError extends Error {
  readonly code = 'SOURCE_FETCH_ERROR';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SourceFetchError';
  }
}

export function getEnv(name: string): string | undefined {
  return typeof Deno !== 'undefined' ? Deno.env.get(name) ?? undefined : undefined;
}

export function asRecord(value: unknown): SourceRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as SourceRecord
    : null;
}

export function asString(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const result = String(value).trim();
    return result || null;
  }
  return null;
}

export function firstString(record: SourceRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

export function extractRecords(payload: unknown): SourceRecord[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((record): record is SourceRecord => record !== null);
  const object = asRecord(payload);
  if (!object) return [];
  for (const key of ['vacancies', 'results', 'items', 'records', 'content']) {
    if (Array.isArray(object[key])) {
      return object[key].map(asRecord).filter((record): record is SourceRecord => record !== null);
    }
  }
  return [];
}

export function extractNextCursor(payload: unknown, currentCursor: string | null): string | null {
  const object = asRecord(payload);
  if (!object) return null;
  const pagination = asRecord(object.pagination) ?? asRecord(object.meta);
  const candidate = firstString(object, ['nextCursor', 'next_cursor', 'nextPage', 'next_page'])
    ?? (pagination ? firstString(pagination, ['nextCursor', 'next_cursor', 'nextPage', 'next_page']) : null);
  if (!candidate || candidate === currentCursor) return null;
  return candidate;
}

export function dedupeByExternalId<T extends { externalId: string }>(records: T[]): T[] {
  return [...new Map(records.map((record) => [record.externalId, record])).values()];
}
