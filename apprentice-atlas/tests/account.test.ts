import { describe, expect, it, vi } from 'vitest';

import { buildAccountExport, deleteAccount } from '../src/lib/account';
import { createDeleteAccountHandler, type DeleteAccountAdmin } from '../supabase/functions/delete-account/handler';

describe('account privacy controls', () => {
  it('builds a portable, versioned export without auth tokens', () => {
    const output = buildAccountExport({
      user: { id: 'user-1', email: 'person@example.com', created_at: '2026-07-01T00:00:00Z' } as never,
      preferences: { onboardingComplete: true, audience: 'student', interests: ['technology'], country: 'Germany', locale: 'de' },
      favorites: [], applications: [], exportedAt: '2026-07-15T12:00:00Z',
    });
    expect(output).toMatchObject({ format: 'apprentice-atlas-account-export', version: 1, account: { id: 'user-1', email: 'person@example.com' } });
    expect(JSON.stringify(output)).not.toContain('access_token');
  });

  it('requires a live local session before invoking account deletion', async () => {
    const invoke = vi.fn();
    const result = await deleteAccount({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) }, functions: { invoke } } as never);
    expect(result.error?.code).toBe('auth-required');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('removes the local career profile only after successful server account deletion', async () => {
    const events: string[] = [];
    const removeCareerProfile = vi.fn(async (id: string) => { events.push(`profile:${id}`); });
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null })),
        signOut: vi.fn(async () => { events.push('signout'); return { error: null }; }),
      },
      functions: { invoke: vi.fn(async () => { events.push('server-delete'); return { data: { deleted: true }, error: null }; }) },
    };

    await expect(deleteAccount(client as never, removeCareerProfile)).resolves.toMatchObject({ error: null });
    expect(events).toEqual(['server-delete', 'profile:user-1', 'signout']);

    events.length = 0;
    client.functions.invoke.mockResolvedValueOnce({ data: { deleted: false }, error: null });
    await expect(deleteAccount(client as never, removeCareerProfile)).resolves.toMatchObject({ error: { code: 'delete' } });
    expect(removeCareerProfile).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });

  it('authenticates from the bearer token and deletes assets before the auth user', async () => {
    const events: string[] = [];
    const remove = vi.fn(async (paths: string[]) => { events.push(`assets:${paths.join(',')}`); return { error: null }; });
    const admin: DeleteAccountAdmin = {
      storage: { from: () => ({ list: vi.fn(async (prefix) => ({ data: prefix === 'user-1' ? [{ name: 'avatar.png', id: 'file-1' }] : [], error: null })), remove }) },
      auth: { admin: { deleteUser: vi.fn(async (id) => { events.push(`user:${id}`); return { error: null }; }) } },
    };
    const handler = createDeleteAccountHandler({
      env: (name) => ({ SUPABASE_URL: 'url', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[name] ?? '',
      createUserClient: () => ({ auth: { getUser: vi.fn(async (token) => ({ data: { user: token === 'valid' ? { id: 'user-1' } : null }, error: null })) } }),
      createAdminClient: () => admin,
    });
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { authorization: 'Bearer valid' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, appleAccessNeedsRevocation: false });
    expect(events).toEqual(['assets:user-1/avatar.png', 'user:user-1']);
  });

  it('never accepts a user id from the request body and returns generic failures', async () => {
    const deleteUser = vi.fn(async () => ({ error: { message: 'sensitive database detail' } }));
    const handler = createDeleteAccountHandler({
      env: () => 'configured',
      createUserClient: () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'token-user' } }, error: null })) } }),
      createAdminClient: () => ({ storage: { from: () => ({ list: vi.fn(async () => ({ data: [], error: null })), remove: vi.fn() }) }, auth: { admin: { deleteUser } } }),
    });
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: JSON.stringify({ userId: 'attacker-choice' }) }));
    expect(deleteUser).toHaveBeenCalledWith('token-user', false);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sensitive database detail');
  });

  it('rejects unauthenticated deletion requests', async () => {
    const handler = createDeleteAccountHandler({ env: () => 'configured', createUserClient: vi.fn() as never, createAdminClient: vi.fn() as never });
    const response = await handler(new Request('https://example.test', { method: 'POST' }));
    expect(response.status).toBe(401);
  });
});
