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
  getReadableFavoritesError,
  invokeSignOut,
  isFavoritesLoading,
  listFavorites,
  optimisticFavoriteState,
  rollbackFavoriteState,
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
  it('accepts only exact Atlas and valid local job return paths', () => {
    expect(isSafeReturnPath(`/job/${job.id}`)).toBe(true);
    expect(isSafeReturnPath('/atlas')).toBe(true);
    expect(isSafeReturnPath('/favorites')).toBe(false);
    expect(isSafeReturnPath('https://evil.test/steal')).toBe(false);
    expect(isSafeReturnPath('/atlas/anything')).toBe(false);
    expect(isSafeReturnPath('/atlas?token=secret')).toBe(false);
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
    const optimisticRemove = optimisticFavoriteState(previous, favorite, 'remove');
    expect(optimisticRemove).toEqual([]);
    expect(rollbackFavoriteState(previous)).toEqual(previous);
    expect(rollbackFavoriteState([])).toEqual([]);
  });

  it('builds compact comparison rows and preserves unavailable jobs', () => {
    const archived = { ...favorite, id: '44444444-4444-4444-8444-444444444444', jobId: '55555555-5555-4555-8555-555555555555', job: undefined };
    expect(buildComparisonRows([favorite, archived], 'en')).toEqual([
      { label: 'Title', values: ['Frontend apprentice', 'No longer available'] },
      { label: 'Company', values: ['Atlas', 'No longer available'] },
      { label: 'Location', values: ['Berlin, DE', 'No longer available'] },
      { label: 'Type', values: ['apprenticeship', 'No longer available'] },
    ]);
    expect(buildComparisonRows([favorite, archived], 'de')[0].label).toBe('Titel');
  });

  it('keeps favorites loading until the authenticated user fetch completes', () => {
    expect(isFavoritesLoading(true, null, null)).toBe(true);
    expect(isFavoritesLoading(false, 'user-1', null)).toBe(true);
    expect(isFavoritesLoading(false, 'user-1', 'user-1')).toBe(false);
  });

  it('localizes database errors and invokes the supplied sign-out action', async () => {
    expect(getReadableFavoritesError({ code: 'mutation', message: 'permission denied' }, 'de')).toContain('gespeichert');
    const signOut = vi.fn(async () => ({ error: null }));
    await invokeSignOut(signOut);
    expect(signOut).toHaveBeenCalledOnce();
  });
});

describe('favorite operations', () => {
  it('uses the authenticated session uid for insert and delete', async () => {
    const calls: Array<{ table: string; values?: unknown }> = [];
    const client = createClient(calls);
    await addFavorite(job.id, client);
    await removeFavorite(job.id, client);
    expect(calls as unknown as Array<{ rpc?: string; table?: string; values?: unknown }>).toEqual([
      { rpc: 'add_favorite', values: { p_job_id: job.id } },
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
    delete: vi.fn(() => { calls.push({ table: 'favorites' }); return chain; }),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: undefined,
  } as any;
  return {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: failure })) },
    from: vi.fn(() => chain),
    rpc: vi.fn((name: string, values: unknown) => { (calls as unknown as Array<{ rpc?: string; table?: string; values?: unknown }>).push({ rpc: name, values }); return Promise.resolve({ data: { id: 'favorite-1', user_id: 'user-1', job_id: job.id, created_at: '2026-07-14T00:00:00.000Z' }, error: failure }); }),
  } as unknown as FavoriteClient;
}
