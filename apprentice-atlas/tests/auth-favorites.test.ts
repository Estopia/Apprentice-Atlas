import { describe, expect, it, vi } from 'vitest';

import {
  getReadableAuthError,
  isSafeReturnPath,
  signUp,
  subscribeToAuth,
  type AuthError,
} from '../src/lib/auth';
import {
  addFavorite,
  buildComparisonRows,
  dedupeFavorites,
  listFavorites,
  optimisticFavoriteState,
  removeFavorite,
  type FavoriteClient,
} from '../src/lib/favorites';
import type { FavoriteJob } from '../src/types/jobs';

const job = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Frontend apprentice',
  company: 'Atlas',
  country: 'DE',
  city: 'Berlin',
  latitude: null,
  longitude: null,
  jobType: 'apprenticeship',
  level: 'entry',
  category: 'technology',
  tags: [],
  rawDescription: 'Build things.',
  requirements: [],
  sourceUrl: 'https://example.test/job',
  applicationUrl: null,
  sourceName: 'Official source',
  status: 'active' as const,
  lastSeenAt: '2026-07-14T00:00:00.000Z',
  expiresAt: null,
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
};

const favorite: FavoriteJob = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: '33333333-3333-4333-8333-333333333333',
  jobId: job.id,
  createdAt: '2026-07-14T00:00:00.000Z',
  job,
};

describe('auth route and readable errors', () => {
  it('accepts only local job return paths', () => {
    expect(isSafeReturnPath(`/job/${job.id}`)).toBe(true);
    expect(isSafeReturnPath('https://evil.test/steal')).toBe(false);
    expect(isSafeReturnPath('/favorites?token=secret')).toBe(false);
  });

  it('maps auth errors to readable localized messages', () => {
    const error: AuthError = { code: 'email-not-confirmed', message: 'raw provider detail' };
    expect(getReadableAuthError(error, 'de')).toContain('E-Mail');
    expect(getReadableAuthError(error, 'en')).toContain('confirm');
  });

  it('exposes unverified signup and forwards session events', async () => {
    const events: string[] = [];
    const auth = {
      signUp: vi.fn(async () => ({ data: { user: { id: 'user-1' }, session: null }, error: null })),
      onAuthStateChange: vi.fn((callback: (event: string, session: null) => void) => { callback('SIGNED_IN', null); return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    };
    const client = { auth } as any;
    const signup = await signUp('person@example.test', 'password123', client);
    subscribeToAuth((event) => events.push(event), client);
    expect(signup.data?.needsEmailConfirmation).toBe(true);
    expect(events).toEqual(['SIGNED_IN']);
  });
});

describe('favorite state and comparison', () => {
  it('deduplicates optimistic additions and rolls back to the previous list', () => {
    const previous = [favorite];
    const next = optimisticFavoriteState(previous, favorite, 'add');
    expect(dedupeFavorites(next)).toHaveLength(1);
    expect(optimisticFavoriteState(next, favorite, 'remove')).toEqual([]);
    expect(optimisticFavoriteState(previous, favorite, 'rollback')).toEqual(previous);
  });

  it('builds compact comparison rows and preserves unavailable jobs', () => {
    const archived = { ...favorite, id: '44444444-4444-4444-8444-444444444444', jobId: '55555555-5555-4555-8555-555555555555', job: undefined };
    expect(buildComparisonRows([favorite, archived])).toEqual([
      { label: 'Title', values: ['Frontend apprentice', 'Unavailable'] },
      { label: 'Company', values: ['Atlas', 'Unavailable'] },
      { label: 'Location', values: ['Berlin, DE', 'Unavailable'] },
      { label: 'Type', values: ['apprenticeship', 'Unavailable'] },
    ]);
  });
});

describe('favorite operations', () => {
  it('uses the authenticated session uid for insert and delete', async () => {
    const calls: Array<{ table: string; values?: unknown }> = [];
    const client = createClient(calls);
    await addFavorite(job.id, client);
    await removeFavorite(job.id, client);
    expect(calls).toEqual([
      { table: 'favorites', values: { user_id: 'user-1', job_id: job.id } },
      { table: 'favorites', values: undefined },
    ]);
  });

  it('lists only records returned for the current authenticated session', async () => {
    const row = { ...favorite, user_id: 'user-1', job_id: job.id, jobs: { ...job, job_type: job.jobType, raw_description: job.rawDescription, last_seen_at: job.lastSeenAt, source_url: job.sourceUrl, source_name: job.sourceName, created_at: job.createdAt, updated_at: job.updatedAt } };
    const query: any = { select: () => query, eq: () => query, order: async () => ({ data: [row], error: null }) };
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null })) }, from: vi.fn(() => query) } as unknown as FavoriteClient;
    const result = await listFavorites(client);
    expect(result.error).toBeNull();
    expect(result.data?.[0].job?.title).toBe(job.title);
  });

  it('surfaces list and mutation errors instead of hiding them', async () => {
    const client = createClient([], new Error('database unavailable'));
    await expect(listFavorites(client)).resolves.toMatchObject({ data: null, error: { message: 'database unavailable' } });
    await expect(addFavorite(job.id, client)).resolves.toMatchObject({ data: null, error: { message: 'database unavailable' } });
  });
});

function createClient(calls: Array<{ table: string; values?: unknown }>, failure?: Error): FavoriteClient {
  const result = { data: null, error: failure };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    insert: vi.fn((values: unknown) => { calls.push({ table: 'favorites', values }); return chain; }),
    delete: vi.fn(() => { calls.push({ table: 'favorites' }); return chain; }),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: undefined,
  } as any;
  return {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: failure })) },
    from: vi.fn(() => chain),
  } as unknown as FavoriteClient;
}
