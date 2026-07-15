import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { UserPreferences } from './preferences';
import type { FavoriteJob, TrackedApplication } from '@/types/jobs';
import { deleteCareerProfile } from './career-profile';

export type AccountOperationError = { code: 'configuration' | 'auth-required' | 'export' | 'delete'; message: string };
export type AccountResult<T> = { data: T | null; error: AccountOperationError | null };

export type AccountExport = {
  format: 'apprentice-atlas-account-export';
  version: 1;
  exportedAt: string;
  account: { id: string; email: string | null; createdAt: string | null };
  preferences: UserPreferences;
  savedOpportunities: FavoriteJob[];
  applications: TrackedApplication[];
};

export function buildAccountExport(input: {
  user: User;
  preferences: UserPreferences;
  favorites: FavoriteJob[];
  applications: TrackedApplication[];
  exportedAt?: string;
}): AccountExport {
  return {
    format: 'apprentice-atlas-account-export',
    version: 1,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    account: { id: input.user.id, email: input.user.email ?? null, createdAt: input.user.created_at ?? null },
    preferences: input.preferences,
    savedOpportunities: input.favorites,
    applications: input.applications,
  };
}

export async function deleteAccount(
  client?: SupabaseClient,
  removeCareerProfile: (userId: string) => Promise<void> = deleteCareerProfile,
): Promise<AccountResult<{ appleAccessNeedsRevocation: boolean }>> {
  let supabase: SupabaseClient;
  try {
    supabase = client ?? (await import('./supabase')).getSupabaseClient();
  } catch (error) {
    return failure('configuration', error instanceof Error ? error.message : 'Supabase is not configured.');
  }

  try {
    const session = await supabase.auth.getSession();
    if (session.error) return failure('delete', 'Could not verify the current session.');
    if (!session.data.session) return failure('auth-required', 'Sign in before deleting an account.');
    const result = await supabase.functions.invoke('delete-account', { method: 'POST', body: {} });
    if (result.error || result.data?.deleted !== true) return failure('delete', 'The account could not be deleted.');
    await removeCareerProfile(session.data.session.user.id);
    await supabase.auth.signOut({ scope: 'local' });
    return { data: { appleAccessNeedsRevocation: result.data.appleAccessNeedsRevocation === true }, error: null };
  } catch {
    return failure('delete', 'The account could not be deleted.');
  }
}

function failure<T>(code: AccountOperationError['code'], message: string): AccountResult<T> {
  return { data: null, error: { code, message } };
}
