import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { buildAccountExport, deleteAccount, retryAccountCleanup } from '../src/lib/account';
import { t } from '../src/lib/i18n';
import { createDeleteAccountHandler, type DeleteAccountAdmin } from '../supabase/functions/delete-account/handler';

const settingsScreen = readFileSync(new URL('../src/app/settings.tsx', import.meta.url), 'utf8');

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

  it('still signs out and reports server deletion success when profile cleanup fails', async () => {
    const events: string[] = [];
    let profileCleanupFails = true;
    const removeCareerProfile = vi.fn(async () => {
      events.push('profile');
      if (profileCleanupFails) throw new Error('sensitive local storage detail');
    });
    const signOut = vi.fn(async () => { events.push('signout'); return { error: null }; });
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null })),
        signOut,
      },
      functions: { invoke: vi.fn(async () => { events.push('server-delete'); return { data: { deleted: true }, error: null }; }) },
    };

    const result = await deleteAccount(client as never, removeCareerProfile);

    expect(events).toEqual(['server-delete', 'profile', 'signout']);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result).toMatchObject({
      data: { appleAccessNeedsRevocation: false },
      error: null,
      cleanupWarning: {
        code: 'local-cleanup-incomplete',
        profileRemovalPending: true,
        signOutPending: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('sensitive local storage detail');

    profileCleanupFails = false;
    await expect(result.cleanupWarning?.retry()).resolves.toBe(true);
    expect(removeCareerProfile).toHaveBeenCalledTimes(2);
  });

  it('records a retryable local warning when sign-out itself fails after server deletion', async () => {
    let signOutFails = true;
    const signOut = vi.fn(async () => {
      if (signOutFails) throw new Error('local sign-out failure');
      return { error: null };
    });
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null })),
        signOut,
      },
      functions: { invoke: vi.fn(async () => ({ data: { deleted: true }, error: null })) },
    };

    const result = await deleteAccount(client as never, vi.fn(async () => undefined));

    expect(result).toMatchObject({
      data: { appleAccessNeedsRevocation: false },
      error: null,
      cleanupWarning: {
        code: 'local-cleanup-incomplete',
        profileRemovalPending: false,
        signOutPending: true,
      },
    });
    signOutFails = false;
    await expect(result.cleanupWarning?.retry()).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('normalizes cleanup retry success, incomplete results, and thrown failures', async () => {
    const warning = (retry: () => Promise<boolean>) => ({
      code: 'local-cleanup-incomplete' as const,
      message: 'Local cleanup is incomplete.',
      profileRemovalPending: true,
      signOutPending: false,
      retry,
    });

    await expect(retryAccountCleanup(warning(async () => true))).resolves.toBe('complete');
    await expect(retryAccountCleanup(warning(async () => false))).resolves.toBe('incomplete');
    await expect(retryAccountCleanup(warning(async () => { throw new Error('local detail'); }))).resolves.toBe('incomplete');
  });

  it('surfaces a localized native retry and explicit continue path before leaving Settings', () => {
    expect(settingsScreen).toContain('result.cleanupWarning');
    expect(settingsScreen).toContain('retryAccountCleanup(cleanupWarning)');
    expect(settingsScreen).toContain("t(locale, 'settings.cleanupTitle')");
    expect(settingsScreen).toContain("t(locale, 'settings.cleanupRetry')");
    expect(settingsScreen).toContain("t(locale, 'settings.cleanupContinue')");
    expect(settingsScreen).toContain("t(locale, 'settings.cleanupSuccessTitle')");
    expect(settingsScreen).toContain('cancelable: false');
    expect(settingsScreen).toContain('continueAfterDelete(appleAccessNeedsRevocation)');
    expect(settingsScreen).toContain("t(locale, 'settings.appleRevokeTitle')");

    const keys = [
      'settings.cleanupTitle', 'settings.cleanupBody', 'settings.cleanupRetry',
      'settings.cleanupContinue', 'settings.cleanupRetryFailedBody',
      'settings.cleanupSuccessTitle', 'settings.cleanupSuccessBody',
    ] as const;
    for (const key of keys) {
      expect(t('de', key)).toBeTruthy();
      expect(t('en', key)).toBeTruthy();
      expect(t('de', key)).not.toBe(t('en', key));
    }
    expect(t('de', 'settings.cleanupBody')).toContain('gelöscht');
    expect(t('en', 'settings.cleanupBody')).toContain('deleted');
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
