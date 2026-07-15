import type { SupabaseClient } from '@supabase/supabase-js';

import type { FavoriteJob, Job } from '@/types/jobs';
import { t, type Locale } from './i18n';

export type FavoriteClient = SupabaseClient;
export type FavoritesError = { code: 'configuration' | 'auth-required' | 'query' | 'mutation'; message: string };
export type FavoritesResult<T> = { data: T | null; error: FavoritesError | null };
export type ComparisonRow = { label: string; values: string[] };

export type FavoriteRemoval = {
  favorites: FavoriteJob[];
  removed: FavoriteJob | null;
};

export type FavoriteOwnership = {
  userId: string | null;
  epoch: number;
};

export function createFavoriteOwnership(userId: string | null): FavoriteOwnership {
  return { userId, epoch: 0 };
}

export function advanceFavoriteOwnership(current: FavoriteOwnership, userId: string | null): FavoriteOwnership {
  return current.userId === userId ? current : { userId, epoch: current.epoch + 1 };
}

export function favoriteOwnershipKey(ownership: FavoriteOwnership): string | null {
  return ownership.userId ? `${ownership.userId}:${ownership.epoch}` : null;
}

export function isCurrentFavoriteOperation(capturedKey: string | null, currentKey: string | null): boolean {
  return capturedKey !== null && capturedKey === currentKey;
}

export function beginFavoriteRemoval(favorites: readonly FavoriteJob[], jobId: string): FavoriteRemoval {
  return {
    favorites: favorites.filter((favorite) => favorite.jobId !== jobId),
    removed: favorites.find((favorite) => favorite.jobId === jobId) ?? null,
  };
}

export function rollbackFavoriteRemoval(favorites: readonly FavoriteJob[], removed: FavoriteJob | null): FavoriteJob[] {
  if (!removed || favorites.some((favorite) => favorite.jobId === removed.jobId)) return [...favorites];
  return [...favorites, removed].sort((left, right) => (
    Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id)
  ));
}

export function isFavoritesLoading(authLoading: boolean, ownershipKey: string | null, loadedForOwnershipKey: string | null): boolean {
  return (!ownershipKey && authLoading) || Boolean(ownershipKey && ownershipKey !== loadedForOwnershipKey);
}

export function getReadableFavoritesError(error: FavoritesError, locale: Locale, operation: 'save' | 'remove' = 'save'): string {
  if (error.code === 'auth-required') return t(locale, 'auth.loginRequired');
  if (error.code === 'configuration') return t(locale, 'saved.errorConfiguration');
  if (error.code === 'query') return t(locale, 'saved.errorLoad');
  return t(locale, operation === 'remove' ? 'saved.errorRemove' : 'saved.errorSave');
}

export async function invokeSignOut(signOut: () => Promise<{ error: unknown }>): Promise<{ error: unknown }> {
  return signOut();
}

function errorResult<T>(error: FavoritesError): FavoritesResult<T> { return { data: null, error }; }
async function clientOrError(client?: FavoriteClient): Promise<FavoriteClient | FavoritesError> {
  if (client) return client;
  try { const module = await import('./supabase'); return module.getSupabaseClient(); } catch (error) { return { code: 'configuration', message: error instanceof Error ? error.message : 'Supabase is not configured.' }; }
}
async function currentUserId(client: FavoriteClient): Promise<FavoritesResult<string>> {
  try { const result = await client.auth.getSession(); if (result.error) return errorResult({ code: 'query', message: result.error.message || 'Could not read the session.' }); const id = result.data.session?.user.id; return id ? { data: id, error: null } : errorResult({ code: 'auth-required', message: 'Sign in to manage favorites.' }); }
  catch (error) { return errorResult({ code: 'query', message: error instanceof Error ? error.message : 'Could not read the session.' }); }
}

function toJob(row: Record<string, unknown> | null): Job | undefined {
  if (!row || typeof row.id !== 'string') return undefined;
  return { id: row.id, title: String(row.title ?? 'Unavailable'), company: String(row.company ?? 'Unavailable'), country: String(row.country ?? ''), city: String(row.city ?? ''), latitude: row.latitude as number | null, longitude: row.longitude as number | null, jobType: String(row.job_type ?? ''), level: String(row.level ?? ''), category: String(row.category ?? ''), tags: Array.isArray(row.tags) ? row.tags as string[] : [], rawDescription: String(row.raw_description ?? ''), requirements: Array.isArray(row.requirements) ? row.requirements as string[] : [], sourceUrl: typeof row.source_url === 'string' ? row.source_url : null, applicationUrl: typeof row.application_url === 'string' ? row.application_url : null, sourceName: String(row.source_name ?? ''), status: row.status === 'expired' || row.status === 'invalid' ? row.status : 'active', lastSeenAt: String(row.last_seen_at ?? ''), expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null, createdAt: String(row.created_at ?? ''), updatedAt: String(row.updated_at ?? '') };
}

function toFavorite(row: Record<string, unknown>): FavoriteJob {
  const related = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
  return { id: String(row.id), userId: String(row.user_id), jobId: String(row.job_id), createdAt: String(row.created_at), job: toJob((related ?? null) as Record<string, unknown> | null) };
}

export async function listFavorites(client?: FavoriteClient): Promise<FavoritesResult<FavoriteJob[]>> {
  const supabase = await clientOrError(client); if ('code' in supabase) return errorResult(supabase);
  const user = await currentUserId(supabase); if (user.error || !user.data) return errorResult(user.error!);
  try { const result = await supabase.from('favorites').select('id,user_id,job_id,created_at,jobs(*)').eq('user_id', user.data).order('created_at', { ascending: false }); if (result.error) return errorResult({ code: 'query', message: result.error.message || 'Could not load favorites.' }); return { data: (result.data ?? []).map((row) => toFavorite(row as Record<string, unknown>)), error: null }; }
  catch (error) { return errorResult({ code: 'query', message: error instanceof Error ? error.message : 'Could not load favorites.' }); }
}

export async function getFavoriteForJob(jobId: string, client?: FavoriteClient): Promise<FavoritesResult<FavoriteJob>> {
  const result = await listFavorites(client); if (result.error) return errorResult(result.error); return { data: result.data?.find((favorite) => favorite.jobId === jobId) ?? null, error: null };
}

export async function addFavorite(jobId: string, client?: FavoriteClient): Promise<FavoritesResult<FavoriteJob>> {
  const supabase = await clientOrError(client); if ('code' in supabase) return errorResult(supabase);
  try { const result = await supabase.rpc('add_favorite', { p_job_id: jobId }); if (result.error) return errorResult({ code: 'mutation', message: result.error.message || 'Could not save favorite.' }); return { data: toFavorite(result.data as Record<string, unknown>), error: null }; }
  catch (error) { return errorResult({ code: 'mutation', message: error instanceof Error ? error.message : 'Could not save favorite.' }); }
}

export async function removeFavorite(jobId: string, client?: FavoriteClient): Promise<FavoritesResult<null>> {
  const supabase = await clientOrError(client); if ('code' in supabase) return errorResult(supabase);
  const user = await currentUserId(supabase); if (user.error || !user.data) return errorResult(user.error!);
  try { const result = await supabase.from('favorites').delete().eq('job_id', jobId).eq('user_id', user.data); if (result.error) return errorResult({ code: 'mutation', message: result.error.message || 'Could not remove favorite.' }); return { data: null, error: null }; }
  catch (error) { return errorResult({ code: 'mutation', message: error instanceof Error ? error.message : 'Could not remove favorite.' }); }
}

export function dedupeFavorites(favorites: FavoriteJob[]): FavoriteJob[] { return favorites.filter((favorite, index, all) => all.findIndex((item) => item.jobId === favorite.jobId) === index); }
export function rollbackFavoriteState<T>(previous: T): T { return previous; }
export function optimisticFavoriteState(current: FavoriteJob[], favorite: FavoriteJob, action: 'add' | 'remove' | 'rollback'): FavoriteJob[] { if (action === 'rollback') return current; return action === 'add' ? dedupeFavorites([...current, favorite]) : current.filter((item) => item.jobId !== favorite.jobId); }
export function buildComparisonRows(favorites: FavoriteJob[], locale: Locale): ComparisonRow[] {
  const unavailable = t(locale, 'saved.unavailable');
  return [
    [t(locale, 'saved.compareTitle'), (favorite: FavoriteJob) => favorite.job?.title ?? unavailable],
    [t(locale, 'saved.compareCompany'), (favorite: FavoriteJob) => favorite.job?.company ?? unavailable],
    [t(locale, 'saved.compareLocation'), (favorite: FavoriteJob) => favorite.job ? `${favorite.job.city}, ${favorite.job.country}` : unavailable],
    [t(locale, 'saved.compareType'), (favorite: FavoriteJob) => favorite.job?.jobType ?? unavailable],
  ].map(([label, value]) => ({ label: label as string, values: favorites.slice(0, 2).map(value as (favorite: FavoriteJob) => string) }));
}
