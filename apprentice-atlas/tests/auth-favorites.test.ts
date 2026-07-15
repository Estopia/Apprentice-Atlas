import { describe, expect, it, vi } from 'vitest';

import {
  createSessionFromUrl,
  getReadableAuthError,
  isSafeReturnPath,
  parseAuthCallbackUrl,
  sendMagicLink,
  signInWithAppleIdToken,
  subscribeToAuth,
  validatedPendingSaveJobId,
  type AuthError,
} from '../src/lib/auth';
import {
  addFavorite,
  advanceFavoriteOwnership,
  beginFavoriteRemoval,
  buildComparisonRows,
  createFavoriteOwnership,
  dedupeFavorites,
  getReadableFavoritesError,
  favoriteOwnershipKey,
  invokeSignOut,
  isFavoritesLoading,
  listFavorites,
  optimisticFavoriteState,
  isCurrentFavoriteOperation,
  rollbackFavoriteRemoval,
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
  it('accepts only exact local app return paths', () => {
    expect(isSafeReturnPath(`/job/${job.id}`)).toBe(true);
    expect(isSafeReturnPath('/')).toBe(true);
    expect(isSafeReturnPath('/favorites')).toBe(true);
    expect(isSafeReturnPath('/atlas')).toBe(true);
    expect(isSafeReturnPath('https://evil.test/steal')).toBe(false);
    expect(isSafeReturnPath('/atlas/anything')).toBe(false);
    expect(isSafeReturnPath('/atlas?token=secret')).toBe(false);
    expect(isSafeReturnPath('/favorites?token=secret')).toBe(false);
  });

  it('continues a pending save only for the exact matching job return path', () => {
    const otherJobId = '66666666-6666-4666-8666-666666666666';

    expect(validatedPendingSaveJobId({ pendingAction: 'save', jobId: job.id, returnTo: `/job/${job.id}` })).toBe(job.id);
    expect(validatedPendingSaveJobId({ pendingAction: 'save', jobId: job.id, returnTo: '/' })).toBe(job.id);
    expect(validatedPendingSaveJobId({ pendingAction: 'save', jobId: job.id, returnTo: '/atlas' })).toBeNull();
    expect(validatedPendingSaveJobId({ pendingAction: 'save', jobId: job.id, returnTo: `/job/${otherJobId}` })).toBeNull();
    expect(validatedPendingSaveJobId({ pendingAction: 'track', jobId: job.id, returnTo: `/job/${job.id}` })).toBeNull();
  });

  it('maps auth errors to readable localized messages', () => {
    const error: AuthError = { code: 'invalid-link', message: 'raw provider detail' };
    expect(getReadableAuthError(error, 'de')).toContain('abgelaufen');
    expect(getReadableAuthError(error, 'en')).toContain('expired');
  });

  it('sends a magic link with a mobile callback and forwards session events', async () => {
    const events: string[] = [];
    const auth = {
      signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
      onAuthStateChange: vi.fn((callback: (event: string, session: null) => void) => { callback('SIGNED_IN', null); return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    };
    const client = { auth } as any;
    const result = await sendMagicLink(' Person@Example.test ', 'apprenticeatlas://auth-callback', client);
    subscribeToAuth((event) => events.push(event), client);
    expect(result.error).toBeNull();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'person@example.test',
      options: { emailRedirectTo: 'apprenticeatlas://auth-callback', shouldCreateUser: true },
    });
    expect(events).toEqual(['SIGNED_IN']);
  });

  it('parses implicit callback tokens and restores the Supabase session', async () => {
    const url = 'apprenticeatlas://auth-callback?returnTo=%2Fatlas#access_token=access&refresh_token=refresh';
    expect(parseAuthCallbackUrl(url)).toMatchObject({ accessToken: 'access', refreshToken: 'refresh' });
    const session = { access_token: 'access', refresh_token: 'refresh' };
    const auth = { setSession: vi.fn(async () => ({ data: { session }, error: null })) };
    const result = await createSessionFromUrl(url, { auth } as any);
    expect(result.data).toBe(session);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
  });

  it('exchanges the Apple identity token and stores the first available name', async () => {
    const session = { access_token: 'apple-access' };
    const auth = {
      signInWithIdToken: vi.fn(async () => ({ data: { session }, error: null })),
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
    };
    const result = await signInWithAppleIdToken({
      identityToken: 'identity-token',
      authorizationCode: 'authorization-code',
      nonce: 'raw-nonce',
      fullName: { givenName: 'Atlas', familyName: 'Apprentice' },
    }, { auth } as any);
    expect(result.data).toBe(session);
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'identity-token',
      nonce: 'raw-nonce',
      access_token: 'authorization-code',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: 'Atlas Apprentice', given_name: 'Atlas', family_name: 'Apprentice' },
    });
  });
});

describe('favorite state and comparison', () => {
  it('keeps ownership stable for token refreshes but invalidates every account boundary', () => {
    const first = createFavoriteOwnership('user-1');
    const tokenRefresh = advanceFavoriteOwnership(first, 'user-1');
    const signedOut = advanceFavoriteOwnership(tokenRefresh, null);
    const sameUserAgain = advanceFavoriteOwnership(signedOut, 'user-1');
    const otherUser = advanceFavoriteOwnership(sameUserAgain, 'user-2');

    expect(tokenRefresh).toBe(first);
    expect(favoriteOwnershipKey(tokenRefresh)).toBe(favoriteOwnershipKey(first));
    expect(favoriteOwnershipKey(signedOut)).toBeNull();
    expect(signedOut.epoch).toBe(1);
    expect(sameUserAgain.epoch).toBe(2);
    expect(otherUser.epoch).toBe(3);
    expect(isCurrentFavoriteOperation(favoriteOwnershipKey(first), favoriteOwnershipKey(sameUserAgain))).toBe(false);
    expect(isCurrentFavoriteOperation(favoriteOwnershipKey(sameUserAgain), favoriteOwnershipKey(otherUser))).toBe(false);
  });

  it('rolls back independent concurrent removals without restoring a full snapshot', () => {
    const second: FavoriteJob = {
      ...favorite,
      id: '44444444-4444-4444-8444-444444444444',
      jobId: '55555555-5555-4555-8555-555555555555',
      createdAt: '2026-07-13T00:00:00.000Z',
    };
    const firstRemoval = beginFavoriteRemoval([favorite, second], favorite.jobId);
    const secondRemoval = beginFavoriteRemoval(firstRemoval.favorites, second.jobId);

    expect(firstRemoval.favorites).toEqual([second]);
    expect(secondRemoval.favorites).toEqual([]);
    expect(rollbackFavoriteRemoval(secondRemoval.favorites, firstRemoval.removed)).toEqual([favorite]);
    expect(rollbackFavoriteRemoval([favorite], secondRemoval.removed)).toEqual([favorite, second]);
    expect(rollbackFavoriteRemoval([favorite], firstRemoval.removed)).toEqual([favorite]);
  });

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
    expect(isFavoritesLoading(true, 'user-1', 'user-1')).toBe(false);
  });

  it('localizes database errors and invokes the supplied sign-out action', async () => {
    expect(getReadableFavoritesError({ code: 'mutation', message: 'permission denied' }, 'de')).toContain('gespeichert');
    const signOut = vi.fn(async () => ({ error: null }));
    await invokeSignOut(signOut);
    expect(signOut).toHaveBeenCalledOnce();
  });
});

describe('favorite operations', () => {
  it('fails closed when account A switches to account B while session resolution is deferred', async () => {
    const accountA = '33333333-3333-4333-8333-333333333333';
    const accountB = '44444444-4444-4444-8444-444444444444';
    let activeUserId = accountA;
    const sessionLookup = deferred<void>();
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const client = {
      auth: {
        getSession: vi.fn(async () => {
          await sessionLookup.promise;
          return {
            data: { session: { access_token: `token-${activeUserId}`, user: { id: activeUserId } } },
            error: null,
          };
        }),
      },
      from: vi.fn(),
      rpc,
    } as unknown as FavoriteClient;

    const mutation = addFavorite(job.id, {
      client,
      expectedUserId: accountA,
      bindClient: () => client,
    });
    activeUserId = accountB;
    sessionLookup.resolve();

    await expect(mutation).resolves.toMatchObject({
      data: null,
      error: { code: 'auth-required' },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('keeps an in-flight account A mutation bound to the captured account A token after switching to B', async () => {
    const accountA = '33333333-3333-4333-8333-333333333333';
    const accountB = '44444444-4444-4444-8444-444444444444';
    let activeUserId = accountA;
    const request = deferred<void>();
    const sourceRpc = vi.fn();
    const boundRpc = vi.fn(async () => {
      await request.promise;
      return {
        data: { id: favorite.id, user_id: accountA, job_id: job.id, created_at: favorite.createdAt },
        error: null,
      };
    });
    const source = {
      auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-a', user: { id: activeUserId } } }, error: null })) },
      from: vi.fn(),
      rpc: sourceRpc,
    } as unknown as FavoriteClient;
    const bound = createClient([]) as FavoriteClient & { rpc: typeof boundRpc };
    bound.rpc = boundRpc as never;
    const capturedTokens: string[] = [];

    const mutation = addFavorite(job.id, {
      client: source,
      expectedUserId: accountA,
      bindClient: (accessToken) => {
        capturedTokens.push(accessToken);
        return bound;
      },
    });
    await vi.waitFor(() => expect(boundRpc).toHaveBeenCalledOnce());
    activeUserId = accountB;
    request.resolve();

    await expect(mutation).resolves.toMatchObject({
      data: { userId: accountA, jobId: job.id },
      error: null,
    });
    expect(capturedTokens).toEqual(['token-a']);
    expect(sourceRpc).not.toHaveBeenCalled();
  });

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
    const client = { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-user-1', user: { id: 'user-1' } } }, error: null })) }, from: vi.fn(() => query) } as unknown as FavoriteClient & { createAuthBoundClient: () => FavoriteClient };
    client.createAuthBoundClient = () => client;
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

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
  const client = {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-user-1', user: { id: 'user-1' } } }, error: failure })) },
    from: vi.fn(() => chain),
    rpc: vi.fn((name: string, values: unknown) => { (calls as unknown as Array<{ rpc?: string; table?: string; values?: unknown }>).push({ rpc: name, values }); return Promise.resolve({ data: { id: 'favorite-1', user_id: 'user-1', job_id: job.id, created_at: '2026-07-14T00:00:00.000Z' }, error: failure }); }),
  } as unknown as FavoriteClient & { createAuthBoundClient: () => FavoriteClient };
  client.createAuthBoundClient = () => client;
  return client;
}
