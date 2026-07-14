import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';

import type { Locale } from './i18n';

export type AuthErrorCode = 'configuration' | 'invalid-credentials' | 'email-not-confirmed' | 'email-in-use' | 'weak-password' | 'network' | 'unknown';
export type AuthError = { code: AuthErrorCode; message: string };
export type AuthResult<T> = { data: T | null; error: AuthError | null };
export type SignUpResult = { user: User | null; session: Session | null; needsEmailConfirmation: boolean };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export function isSafeReturnPath(path: string | undefined): path is `/job/${string}` {
  return Boolean(path && new RegExp(`^/job/${uuidPattern}$`, 'i').test(path));
}

export function getReadableAuthError(error: AuthError, locale: Locale): string {
  const messages: Record<Locale, Record<AuthErrorCode, string>> = {
    de: {
      configuration: 'Anmeldung ist gerade nicht verfügbar.', 'invalid-credentials': 'E-Mail oder Passwort ist nicht korrekt.',
      'email-not-confirmed': 'Bestätige zuerst deine E-Mail-Adresse.', 'email-in-use': 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
      'weak-password': 'Das Passwort ist zu schwach.', network: 'Netzwerkfehler. Bitte versuche es erneut.', unknown: 'Anmeldung fehlgeschlagen.',
    },
    en: {
      configuration: 'Sign-in is currently unavailable.', 'invalid-credentials': 'The email or password is incorrect.',
      'email-not-confirmed': 'Please confirm your email address first.', 'email-in-use': 'An account already exists for this email address.',
      'weak-password': 'Choose a stronger password.', network: 'Network error. Please try again.', unknown: 'Sign-in failed.',
    },
  };
  return messages[locale][error.code] ?? error.message;
}

function normalizeAuthError(error: unknown): AuthError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  const code: AuthErrorCode = lower.includes('invalid login') || lower.includes('invalid credentials') ? 'invalid-credentials'
    : lower.includes('not confirmed') || lower.includes('email not confirmed') ? 'email-not-confirmed'
    : lower.includes('already registered') || lower.includes('already exists') ? 'email-in-use'
    : lower.includes('password') && (lower.includes('weak') || lower.includes('short')) ? 'weak-password'
    : lower.includes('network') || lower.includes('fetch') ? 'network' : 'unknown';
  return { code, message: message || 'Authentication failed.' };
}

async function clientOrError(client?: SupabaseClient): Promise<SupabaseClient | AuthError> {
  if (client) return client;
  try { const module = await import('./supabase'); return module.getSupabaseClient(); } catch (error) { return { code: 'configuration', message: error instanceof Error ? error.message : 'Supabase is not configured.' }; }
}

export async function getSession(client?: SupabaseClient): Promise<AuthResult<Session>> {
  const supabase = await clientOrError(client); if ('code' in supabase) return { data: null, error: supabase };
  try { const result = await supabase.auth.getSession(); return { data: result.data.session, error: result.error ? normalizeAuthError(result.error) : null }; }
  catch (error) { return { data: null, error: normalizeAuthError(error) }; }
}

export async function signIn(email: string, password: string, client?: SupabaseClient): Promise<AuthResult<Session>> {
  if (!emailPattern.test(email.trim()) || !password) return { data: null, error: { code: 'invalid-credentials', message: 'Enter a valid email and password.' } };
  const supabase = await clientOrError(client); if ('code' in supabase) return { data: null, error: supabase };
  try { const result = await supabase.auth.signInWithPassword({ email: email.trim(), password }); return { data: result.data.session, error: result.error ? normalizeAuthError(result.error) : null }; }
  catch (error) { return { data: null, error: normalizeAuthError(error) }; }
}

export async function signUp(email: string, password: string, client?: SupabaseClient): Promise<AuthResult<SignUpResult>> {
  if (!emailPattern.test(email.trim()) || password.length < 8) return { data: null, error: { code: password.length < 8 ? 'weak-password' : 'invalid-credentials', message: 'Enter a valid email and a password with at least 8 characters.' } };
  const supabase = await clientOrError(client); if ('code' in supabase) return { data: null, error: supabase };
  try {
    const result = await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) return { data: null, error: normalizeAuthError(result.error) };
    const data = { user: result.data.user, session: result.data.session, needsEmailConfirmation: Boolean(result.data.user && !result.data.session) };
    return { data, error: null };
  } catch (error) { return { data: null, error: normalizeAuthError(error) }; }
}

export async function signOut(client?: SupabaseClient): Promise<{ error: AuthError | null }> {
  const supabase = await clientOrError(client); if ('code' in supabase) return { error: supabase };
  try { const result = await supabase.auth.signOut(); return { error: result.error ? normalizeAuthError(result.error) : null }; }
  catch (error) { return { error: normalizeAuthError(error) }; }
}

export async function getAuthClient(): Promise<SupabaseClient | AuthError> { return clientOrError(); }

export function subscribeToAuth(callback: (event: AuthChangeEvent, session: Session | null) => void, client?: SupabaseClient): { unsubscribe: () => void } {
  if (!client) return { unsubscribe: () => undefined };
  const supabase = client;
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}
