import type {
  AuthChangeEvent,
  Session,
  SignInWithIdTokenCredentials,
  SupabaseClient,
} from '@supabase/supabase-js';

import type { Locale } from './i18n';

export type AuthErrorCode =
  | 'configuration'
  | 'invalid-email'
  | 'invalid-link'
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'email-in-use'
  | 'weak-password'
  | 'provider'
  | 'network'
  | 'unknown';
export type AuthError = { code: AuthErrorCode; message: string };
export type AuthResult<T> = { data: T | null; error: AuthError | null };

export type AppleIdToken = {
  identityToken: string;
  nonce: string;
  authorizationCode?: string | null;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  } | null;
};

type AuthCallbackParams = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  error: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export function isSafeReturnPath(path: string | undefined): path is '/' | '/map' | '/search' | '/favorites' | '/atlas' | '/settings' | `/job/${string}` {
  return path === '/'
    || path === '/map'
    || path === '/search'
    || path === '/favorites'
    || path === '/atlas'
    || path === '/settings'
    || Boolean(path && new RegExp(`^/(job|prepare)/${uuidPattern}$`, 'i').test(path));
}

export function validatedPendingSaveJobId(params: {
  pendingAction?: string;
  jobId?: string;
  returnTo?: string;
}): string | null {
  const { pendingAction, jobId, returnTo } = params;
  if (pendingAction !== 'save' || !jobId || !isSafeReturnPath(returnTo)) return null;
  return returnTo === `/job/${jobId}` || returnTo === '/' || returnTo === '/map' ? jobId : null;
}

export function getReadableAuthError(error: AuthError, locale: Locale): string {
  const messages: Record<Locale, Record<AuthErrorCode, string>> = {
    de: {
      configuration: 'Anmeldung ist gerade nicht verfügbar.',
      'invalid-email': 'Gib eine gültige E-Mail-Adresse ein.',
      'invalid-link': 'Dieser Anmeldelink ist ungültig oder abgelaufen. Fordere bitte einen neuen an.',
      'invalid-credentials': 'Die Anmeldedaten sind nicht korrekt.',
      'email-not-confirmed': 'Bestätige zuerst deine E-Mail-Adresse.',
      'email-in-use': 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
      'weak-password': 'Das Passwort ist zu schwach.',
      provider: 'Diese Anmeldemethode ist gerade nicht verfügbar.',
      network: 'Netzwerkfehler. Bitte versuche es erneut.',
      unknown: 'Anmeldung fehlgeschlagen.',
    },
    en: {
      configuration: 'Sign-in is currently unavailable.',
      'invalid-email': 'Enter a valid email address.',
      'invalid-link': 'This sign-in link is invalid or has expired. Please request a new one.',
      'invalid-credentials': 'The sign-in details are incorrect.',
      'email-not-confirmed': 'Please confirm your email address first.',
      'email-in-use': 'An account already exists for this email address.',
      'weak-password': 'Choose a stronger password.',
      provider: 'This sign-in method is currently unavailable.',
      network: 'Network error. Please try again.',
      unknown: 'Sign-in failed.',
    },
  };
  return messages[locale][error.code] ?? error.message;
}

function normalizeAuthError(error: unknown): AuthError {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  const code: AuthErrorCode = lower.includes('expired') || lower.includes('otp') || lower.includes('link is invalid')
    ? 'invalid-link'
    : lower.includes('invalid email') || lower.includes('email address')
      ? 'invalid-email'
      : lower.includes('provider') || lower.includes('apple') && lower.includes('enabled')
        ? 'provider'
        : lower.includes('network') || lower.includes('fetch')
          ? 'network'
          : 'unknown';
  return { code, message: message || 'Authentication failed.' };
}

async function clientOrError(client?: SupabaseClient): Promise<SupabaseClient | AuthError> {
  if (client) return client;
  try {
    const module = await import('./supabase');
    return module.getSupabaseClient();
  } catch (error) {
    return {
      code: 'configuration',
      message: error instanceof Error ? error.message : 'Supabase is not configured.',
    };
  }
}

export async function getSession(client?: SupabaseClient): Promise<AuthResult<Session>> {
  const supabase = await clientOrError(client);
  if ('code' in supabase) return { data: null, error: supabase };
  try {
    const result = await supabase.auth.getSession();
    return { data: result.data.session, error: result.error ? normalizeAuthError(result.error) : null };
  } catch (error) {
    return { data: null, error: normalizeAuthError(error) };
  }
}

export async function sendMagicLink(
  email: string,
  redirectTo: string,
  client?: SupabaseClient,
): Promise<{ error: AuthError | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!emailPattern.test(normalizedEmail)) {
    return { error: { code: 'invalid-email', message: 'Enter a valid email address.' } };
  }
  const supabase = await clientOrError(client);
  if ('code' in supabase) return { error: supabase };
  try {
    const result = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    return { error: result.error ? normalizeAuthError(result.error) : null };
  } catch (error) {
    return { error: normalizeAuthError(error) };
  }
}

export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  const [withoutHash, hash = ''] = url.split('#', 2);
  const query = withoutHash.includes('?') ? withoutHash.slice(withoutHash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);
  const read = (key: string) => hashParams.get(key) ?? params.get(key);
  return {
    accessToken: read('access_token'),
    refreshToken: read('refresh_token'),
    code: read('code'),
    error: read('error_description') ?? read('error'),
  };
}

export async function createSessionFromUrl(url: string, client?: SupabaseClient): Promise<AuthResult<Session>> {
  const params = parseAuthCallbackUrl(url);
  if (params.error) return { data: null, error: normalizeAuthError(new Error(params.error)) };

  const supabase = await clientOrError(client);
  if ('code' in supabase) return { data: null, error: supabase };
  try {
    if (params.code) {
      const result = await supabase.auth.exchangeCodeForSession(params.code);
      return { data: result.data.session, error: result.error ? normalizeAuthError(result.error) : null };
    }
    if (params.accessToken && params.refreshToken) {
      const result = await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });
      return { data: result.data.session, error: result.error ? normalizeAuthError(result.error) : null };
    }
    return {
      data: null,
      error: { code: 'invalid-link', message: 'The callback did not contain a valid session.' },
    };
  } catch (error) {
    return { data: null, error: normalizeAuthError(error) };
  }
}

export async function signInWithAppleIdToken(
  credential: AppleIdToken,
  client?: SupabaseClient,
): Promise<AuthResult<Session>> {
  if (!credential.identityToken || !credential.nonce) {
    return { data: null, error: { code: 'provider', message: 'Apple did not return a valid credential.' } };
  }
  const supabase = await clientOrError(client);
  if ('code' in supabase) return { data: null, error: supabase };

  const tokenCredentials: SignInWithIdTokenCredentials = {
    provider: 'apple',
    token: credential.identityToken,
    nonce: credential.nonce,
  };
  if (credential.authorizationCode) tokenCredentials.access_token = credential.authorizationCode;

  try {
    const result = await supabase.auth.signInWithIdToken(tokenCredentials);
    if (result.error) return { data: null, error: normalizeAuthError(result.error) };

    const givenName = credential.fullName?.givenName?.trim() || null;
    const familyName = credential.fullName?.familyName?.trim() || null;
    if (givenName || familyName) {
      await supabase.auth.updateUser({
        data: {
          full_name: [givenName, familyName].filter(Boolean).join(' '),
          given_name: givenName,
          family_name: familyName,
        },
      });
    }
    return { data: result.data.session, error: null };
  } catch (error) {
    return { data: null, error: normalizeAuthError(error) };
  }
}

export async function signOut(client?: SupabaseClient): Promise<{ error: AuthError | null }> {
  const supabase = await clientOrError(client);
  if ('code' in supabase) return { error: supabase };
  try {
    const result = await supabase.auth.signOut();
    return { error: result.error ? normalizeAuthError(result.error) : null };
  } catch (error) {
    return { error: normalizeAuthError(error) };
  }
}

export async function getAuthClient(): Promise<SupabaseClient | AuthError> {
  return clientOrError();
}

export function subscribeToAuth(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
  client?: SupabaseClient,
): { unsubscribe: () => void } {
  if (!client) return { unsubscribe: () => undefined };
  const { data } = client.auth.onAuthStateChange(callback);
  return data.subscription;
}
