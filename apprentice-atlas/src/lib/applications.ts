import type { SupabaseClient } from '@supabase/supabase-js';

import { applicationNoteLength, isApplicationStatus } from './application-flow';
import { t, type Locale } from './i18n';
import type { ApplicationStatus, Job, TrackedApplication } from '@/types/jobs';

export type ApplicationClient = SupabaseClient;
export type ApplicationsError = {
  code: 'configuration' | 'auth-required' | 'query' | 'mutation' | 'validation';
  message: string;
};
export type ApplicationsResult<T> = { data: T | null; error: ApplicationsError | null };
export type ApplicationsOperation = 'load' | 'save' | 'remove';

const APPLICATION_SELECT = 'id,user_id,job_id,status,note,created_at,updated_at,jobs(*)';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResult<T>(error: ApplicationsError): ApplicationsResult<T> {
  return { data: null, error };
}

async function clientOrError(client?: ApplicationClient): Promise<ApplicationClient | ApplicationsError> {
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

async function currentUserId(client: ApplicationClient): Promise<ApplicationsResult<string>> {
  try {
    const result = await client.auth.getSession();
    if (result.error) {
      return errorResult({ code: 'query', message: result.error.message || 'Could not read the session.' });
    }
    const userId = result.data.session?.user.id;
    return userId
      ? { data: userId, error: null }
      : errorResult({ code: 'auth-required', message: 'Sign in to manage applications.' });
  } catch (error) {
    return errorResult({
      code: 'query',
      message: error instanceof Error ? error.message : 'Could not read the session.',
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toJob(value: unknown): Job | undefined {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) return undefined;
  const applicationUrl = row.application_url ?? null;
  if (
    typeof row.id !== 'string'
    || typeof row.title !== 'string'
    || typeof row.company !== 'string'
    || typeof row.country !== 'string'
    || typeof row.city !== 'string'
    || (row.latitude !== null && typeof row.latitude !== 'number')
    || (row.longitude !== null && typeof row.longitude !== 'number')
    || typeof row.job_type !== 'string'
    || typeof row.level !== 'string'
    || typeof row.category !== 'string'
    || !isStringArray(row.tags)
    || typeof row.raw_description !== 'string'
    || !isStringArray(row.requirements)
    || !isNullableString(row.source_url)
    || !isNullableString(applicationUrl)
    || typeof row.source_name !== 'string'
    || (row.status !== 'active' && row.status !== 'expired' && row.status !== 'invalid')
    || typeof row.last_seen_at !== 'string'
    || !isNullableString(row.expires_at)
    || typeof row.created_at !== 'string'
    || typeof row.updated_at !== 'string'
  ) return undefined;

  return {
    id: row.id,
    title: row.title,
    company: row.company,
    country: row.country,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    jobType: row.job_type,
    level: row.level,
    category: row.category,
    tags: row.tags,
    rawDescription: row.raw_description,
    requirements: row.requirements,
    sourceUrl: row.source_url,
    applicationUrl,
    sourceName: row.source_name,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toApplication(value: unknown): TrackedApplication | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string'
    || typeof value.user_id !== 'string'
    || typeof value.job_id !== 'string'
    || !isApplicationStatus(value.status)
    || !isNullableString(value.note)
    || (typeof value.note === 'string' && applicationNoteLength(value.note) > 500)
    || typeof value.created_at !== 'string'
    || typeof value.updated_at !== 'string'
  ) return null;

  return {
    id: value.id,
    userId: value.user_id,
    jobId: value.job_id,
    status: value.status,
    note: value.note,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    job: toJob(value.jobs),
  };
}

function validationError(message: string): ApplicationsError {
  return { code: 'validation', message };
}

export function getReadableApplicationsError(
  error: ApplicationsError,
  locale: Locale,
  operation: ApplicationsOperation = 'load',
): string {
  if (error.code === 'auth-required') return t(locale, 'application.error.authRequired');
  if (error.code === 'configuration') return t(locale, 'application.error.configuration');
  if (error.code === 'validation') return t(locale, 'application.error.validation');
  return t(locale, operation === 'save'
    ? 'application.error.save'
    : operation === 'remove'
      ? 'application.error.remove'
      : 'application.error.load');
}

function validateJobId(jobId: string): ApplicationsError | null {
  return UUID_PATTERN.test(jobId) ? null : validationError('Invalid job identifier.');
}

function normalizeNote(note: string | null): { data: string | null; error: ApplicationsError | null } {
  if (note !== null && typeof note !== 'string') {
    return { data: null, error: validationError('The application note must be text.') };
  }
  const normalized = note?.trim() || null;
  if (normalized && applicationNoteLength(normalized) > 500) {
    return { data: null, error: validationError('The application note cannot exceed 500 characters.') };
  }
  return { data: normalized, error: null };
}

export async function listApplications(client?: ApplicationClient): Promise<ApplicationsResult<TrackedApplication[]>> {
  const supabase = await clientOrError(client);
  if ('code' in supabase) return errorResult(supabase);
  const user = await currentUserId(supabase);
  if (user.error || !user.data) return errorResult(user.error!);

  try {
    const result = await supabase
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('user_id', user.data)
      .order('updated_at', { ascending: false });
    if (result.error) {
      return errorResult({ code: 'query', message: result.error.message || 'Could not load applications.' });
    }
    if (!Array.isArray(result.data)) return errorResult(validationError('Invalid application data.'));
    const applications = result.data.map(toApplication);
    if (applications.some((application) => application === null)) {
      return errorResult(validationError('Invalid application data.'));
    }
    return { data: applications as TrackedApplication[], error: null };
  } catch (error) {
    return errorResult({
      code: 'query',
      message: error instanceof Error ? error.message : 'Could not load applications.',
    });
  }
}

export async function getApplicationForJob(
  jobId: string,
  client?: ApplicationClient,
): Promise<ApplicationsResult<TrackedApplication>> {
  const supabase = await clientOrError(client);
  if ('code' in supabase) return errorResult(supabase);
  const user = await currentUserId(supabase);
  if (user.error || !user.data) return errorResult(user.error!);
  const invalidJob = validateJobId(jobId);
  if (invalidJob) return errorResult(invalidJob);

  try {
    const result = await supabase
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('user_id', user.data)
      .eq('job_id', jobId)
      .maybeSingle();
    if (result.error) {
      return errorResult({ code: 'query', message: result.error.message || 'Could not load the application.' });
    }
    if (!result.data) return { data: null, error: null };
    const application = toApplication(result.data);
    return application
      ? { data: application, error: null }
      : errorResult(validationError('Invalid application data.'));
  } catch (error) {
    return errorResult({
      code: 'query',
      message: error instanceof Error ? error.message : 'Could not load the application.',
    });
  }
}

export async function upsertApplication(
  jobId: string,
  status: ApplicationStatus,
  note: string | null,
  client?: ApplicationClient,
): Promise<ApplicationsResult<TrackedApplication>> {
  const supabase = await clientOrError(client);
  if ('code' in supabase) return errorResult(supabase);
  const user = await currentUserId(supabase);
  if (user.error || !user.data) return errorResult(user.error!);
  const invalidJob = validateJobId(jobId);
  if (invalidJob) return errorResult(invalidJob);
  if (!isApplicationStatus(status)) return errorResult(validationError('Invalid application status.'));
  const normalizedNote = normalizeNote(note);
  if (normalizedNote.error) return errorResult(normalizedNote.error);

  try {
    const result = await supabase.rpc('upsert_application', {
      p_job_id: jobId,
      p_status: status,
      p_note: normalizedNote.data,
    });
    if (result.error) {
      return errorResult({ code: 'mutation', message: result.error.message || 'Could not save the application.' });
    }
    const application = toApplication(Array.isArray(result.data) ? result.data[0] : result.data);
    return application
      ? { data: application, error: null }
      : errorResult(validationError('Invalid application data.'));
  } catch (error) {
    return errorResult({
      code: 'mutation',
      message: error instanceof Error ? error.message : 'Could not save the application.',
    });
  }
}

export async function removeApplication(
  jobId: string,
  client?: ApplicationClient,
): Promise<ApplicationsResult<null>> {
  const supabase = await clientOrError(client);
  if ('code' in supabase) return errorResult(supabase);
  const user = await currentUserId(supabase);
  if (user.error || !user.data) return errorResult(user.error!);
  const invalidJob = validateJobId(jobId);
  if (invalidJob) return errorResult(invalidJob);

  try {
    const result = await supabase
      .from('applications')
      .delete()
      .eq('user_id', user.data)
      .eq('job_id', jobId);
    if (result.error) {
      return errorResult({ code: 'mutation', message: result.error.message || 'Could not remove the application.' });
    }
    return { data: null, error: null };
  } catch (error) {
    return errorResult({
      code: 'mutation',
      message: error instanceof Error ? error.message : 'Could not remove the application.',
    });
  }
}
