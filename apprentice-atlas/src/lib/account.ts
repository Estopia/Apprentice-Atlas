import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { UserPreferences } from './preferences';
import type { FavoriteJob, TrackedApplication } from '@/types/jobs';
import { deleteCareerProfile } from './career-profile';
import type { Locale } from './i18n';

export type AccountOperationError = { code: 'configuration' | 'auth-required' | 'export' | 'delete'; message: string };
export type AccountCleanupWarning = {
  code: 'local-cleanup-incomplete';
  message: string;
  profileRemovalPending: boolean;
  signOutPending: boolean;
  retry(): Promise<boolean>;
};
export type AccountResult<T> = {
  data: T | null;
  error: AccountOperationError | null;
  cleanupWarning?: AccountCleanupWarning;
};

export async function retryAccountCleanup(warning: AccountCleanupWarning): Promise<'complete' | 'incomplete'> {
  try {
    return await warning.retry() ? 'complete' : 'incomplete';
  } catch {
    return 'incomplete';
  }
}

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

const reportCopy = {
  de: {
    title: 'Apprentice Atlas Kontobericht', subtitle: 'Lesbarer Export deiner Kontodaten', exported: 'Exportiert',
    account: 'Konto', email: 'E-Mail', userId: 'Nutzer-ID', created: 'Erstellt',
    preferences: 'Präferenzen', audience: 'Ausgangslage', audienceStudent: 'Schüler:in', audienceDropout: 'Neuorientierung',
    country: 'Suchland', language: 'Sprache', interests: 'Interessen', onboarding: 'Einrichtung abgeschlossen', yes: 'Ja', no: 'Nein',
    saved: 'Gespeicherte Chancen', applications: 'Bewerbungen', company: 'Unternehmen', location: 'Ort', savedAt: 'Gespeichert am',
    status: 'Status', note: 'Notiz', interview: 'Gesprächstermin', updated: 'Aktualisiert', none: 'Keine', unavailable: 'Nicht verfügbar',
    privacy: 'Dieser Bericht enthält nur ausgewählte Kontodaten. Vollständige Anzeigentexte, Anmeldedaten, lokale Benachrichtigungs-IDs und dein lokaler Vorbereitungsentwurf sind nicht enthalten.',
  },
  en: {
    title: 'Apprentice Atlas account report', subtitle: 'Human-readable export of your account data', exported: 'Exported',
    account: 'Account', email: 'Email', userId: 'User ID', created: 'Created',
    preferences: 'Preferences', audience: 'Current situation', audienceStudent: 'Student', audienceDropout: 'Changing direction',
    country: 'Search country', language: 'Language', interests: 'Interests', onboarding: 'Setup complete', yes: 'Yes', no: 'No',
    saved: 'Saved opportunities', applications: 'Applications', company: 'Company', location: 'Location', savedAt: 'Saved',
    status: 'Status', note: 'Note', interview: 'Interview date', updated: 'Updated', none: 'None', unavailable: 'Unavailable',
    privacy: 'This report contains selected account data only. Full listing descriptions, authentication credentials, local notification identifiers, and your local preparation draft are excluded.',
  },
} as const;

const applicationStatusCopy = {
  de: { interested: 'Interessiert', preparing: 'Vorbereitung', applied: 'Beworben', interview: 'Vorstellungsgespräch', offer: 'Zusage', closed: 'Abgeschlossen' },
  en: { interested: 'Interested', preparing: 'Preparing', applied: 'Applied', interview: 'Interview', offer: 'Offer', closed: 'Closed' },
} as const;

export function escapeAccountPdfHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAccountPdfHtml(data: AccountExport, locale: Locale): string {
  const copy = reportCopy[locale];
  const field = (label: string, value: string | null | undefined) => (
    `<div class="field"><dt>${escapeAccountPdfHtml(label)}</dt><dd>${escapeAccountPdfHtml(value || copy.unavailable)}</dd></div>`
  );
  const location = (job: FavoriteJob['job'] | TrackedApplication['job']) => {
    if (!job) return copy.unavailable;
    const country = locale === 'de' && job.country === 'Germany'
      ? 'Deutschland'
      : locale === 'de' && job.country === 'United Kingdom'
        ? 'Vereinigtes Königreich'
        : job.country;
    return [job.city, country].filter(Boolean).join(', ') || copy.unavailable;
  };
  const date = (value: string | null | undefined, includeTime = false) => formatReportDate(value, locale, includeTime, copy.unavailable);
  const audience = data.preferences.audience === 'student'
    ? copy.audienceStudent
    : data.preferences.audience === 'dropout'
      ? copy.audienceDropout
      : copy.unavailable;
  const saved = data.savedOpportunities.map((favorite) => `
    <article class="record">
      <h3>${escapeAccountPdfHtml(favorite.job?.title ?? favorite.jobId)}</h3>
      <dl>${field(copy.company, favorite.job?.company)}${field(copy.location, location(favorite.job))}${field(copy.savedAt, date(favorite.createdAt))}</dl>
    </article>`).join('');
  const applications = data.applications.map((application) => `
    <article class="record">
      <h3>${escapeAccountPdfHtml(application.job?.title ?? application.jobId)}</h3>
      <dl>${field(copy.company, application.job?.company)}${field(copy.location, location(application.job))}${field(copy.status, applicationStatusCopy[locale][application.status])}${field(copy.note, application.note || copy.none)}${field(copy.interview, application.interviewAt ? date(application.interviewAt, true) : copy.none)}${field(copy.updated, date(application.updatedAt))}</dl>
    </article>`).join('');

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeAccountPdfHtml(copy.title)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; }
    body { max-width: 178mm; margin: 0 auto; }
    header { padding: 0 0 9mm; border-bottom: 3px solid #155eef; }
    .brand { color: #155eef; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: 9pt; }
    h1 { margin: 2mm 0 1mm; color: #111; font-size: 24pt; line-height: 1.1; }
    .subtitle, .meta, .privacy { color: #333; }
    .meta { margin-top: 3mm; }
    section { margin-top: 8mm; break-inside: avoid; }
    h2 { margin: 0 0 3mm; padding-bottom: 2mm; border-bottom: 1px solid #555; font-size: 15pt; color: #111; }
    h3 { margin: 0 0 3mm; font-size: 12pt; color: #111; }
    dl { display: grid; grid-template-columns: minmax(34mm, 1fr) 2fr; gap: 1.5mm 5mm; margin: 0; }
    .field { display: contents; }
    dt { color: #333; font-weight: 700; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .record { padding: 4mm; margin-top: 3mm; border: 1px solid #777; border-radius: 2mm; break-inside: avoid; background: #fff; }
    .empty { padding: 4mm; border: 1px solid #777; }
    .privacy { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #777; font-size: 8.5pt; }
    @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">Apprentice Atlas</div>
    <h1>${escapeAccountPdfHtml(copy.title)}</h1>
    <div class="subtitle">${escapeAccountPdfHtml(copy.subtitle)}</div>
    <div class="meta">${escapeAccountPdfHtml(copy.exported)}: ${escapeAccountPdfHtml(date(data.exportedAt, true))}</div>
  </header>
  <section><h2>${escapeAccountPdfHtml(copy.account)}</h2><dl>${field(copy.email, data.account.email)}${field(copy.userId, data.account.id)}${field(copy.created, date(data.account.createdAt))}</dl></section>
  <section><h2>${escapeAccountPdfHtml(copy.preferences)}</h2><dl>${field(copy.audience, audience)}${field(copy.country, data.preferences.country)}${field(copy.language, data.preferences.locale.toUpperCase())}${field(copy.interests, data.preferences.interests.length ? data.preferences.interests.join(', ') : copy.none)}${field(copy.onboarding, data.preferences.onboardingComplete ? copy.yes : copy.no)}</dl></section>
  <section><h2>${escapeAccountPdfHtml(copy.saved)}</h2>${saved || `<div class="empty">${escapeAccountPdfHtml(copy.none)}</div>`}</section>
  <section><h2>${escapeAccountPdfHtml(copy.applications)}</h2>${applications || `<div class="empty">${escapeAccountPdfHtml(copy.none)}</div>`}</section>
  <p class="privacy">${escapeAccountPdfHtml(copy.privacy)}</p>
</body>
</html>`;
}

function formatReportDate(value: string | null | undefined, locale: Locale, includeTime: boolean, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}),
    timeZone: 'UTC',
  }).format(parsed);
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
    const deletedUserId = session.data.session.user.id;
    const tryProfileRemoval = async () => {
      try {
        await removeCareerProfile(deletedUserId);
        return true;
      } catch {
        return false;
      }
    };
    const tryLocalSignOut = async () => {
      try {
        const signOut = await supabase.auth.signOut({ scope: 'local' });
        return !signOut.error;
      } catch {
        return false;
      }
    };

    const profileRemoved = await tryProfileRemoval();
    const signedOut = await tryLocalSignOut();
    const data = { appleAccessNeedsRevocation: result.data.appleAccessNeedsRevocation === true };
    if (profileRemoved && signedOut) return { data, error: null };

    const cleanupWarning: AccountCleanupWarning = {
      code: 'local-cleanup-incomplete',
      message: 'The account was deleted, but cleanup on this device is incomplete.',
      profileRemovalPending: !profileRemoved,
      signOutPending: !signedOut,
      retry: async () => {
        if (cleanupWarning.profileRemovalPending) {
          cleanupWarning.profileRemovalPending = !await tryProfileRemoval();
        }
        if (cleanupWarning.signOutPending) {
          cleanupWarning.signOutPending = !await tryLocalSignOut();
        }
        return !cleanupWarning.profileRemovalPending && !cleanupWarning.signOutPending;
      },
    };
    return { data, error: null, cleanupWarning };
  } catch {
    return failure('delete', 'The account could not be deleted.');
  }
}

function failure<T>(code: AccountOperationError['code'], message: string): AccountResult<T> {
  return { data: null, error: { code, message } };
}
