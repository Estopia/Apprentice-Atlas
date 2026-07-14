import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabase';
import type { Job, JobFilter } from '../types/jobs';
import { isWithinRadius, mergeJobs, serializeBoundingBox, serializeJobFilters } from './job-filters';

export { getBoundingBox, hasMapPosition, isWithinRadius, mergeJobs, serializeBoundingBox, serializeJobFilters } from './job-filters';

export type JobsError = { code: 'configuration' | 'query' | 'invalid-filter'; message: string };
export type JobsResult = { data: Job[]; error: JobsError | null };

type JobRow = {
  id: string; title: string; company: string; country: string; city: string;
  latitude: number | null; longitude: number | null; job_type: string; level: string;
  category: string; tags: string[] | null; raw_description: string; requirements: string[] | null;
  source_url: string; application_url: string | null; source_name: string; status: Job['status']; last_seen_at: string;
  expires_at: string | null; created_at: string; updated_at: string;
};

function fromRow(row: JobRow): Job {
  return {
    id: row.id, title: row.title, company: row.company, country: row.country, city: row.city,
    latitude: row.latitude, longitude: row.longitude, jobType: row.job_type, level: row.level,
    category: row.category, tags: row.tags ?? [], rawDescription: row.raw_description,
    requirements: row.requirements ?? [], sourceUrl: row.source_url, applicationUrl: row.application_url ?? null, sourceName: row.source_name,
    status: row.status, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function getJob(id: string, client?: SupabaseClient): Promise<{ data: Job | null; error: JobsError | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { data: null, error: { code: 'query', message: 'Invalid job identifier.' } };
  try {
    const result = await (client ?? getSupabaseClient()).from('jobs').select('*').eq('id', id).eq('status', 'active').maybeSingle();
    if (result.error) return { data: null, error: { code: 'query', message: result.error.message || 'Could not load the job.' } };
    return { data: result.data ? fromRow(result.data as JobRow) : null, error: null };
  } catch (error) {
    return { data: null, error: { code: 'configuration', message: error instanceof Error ? error.message : 'Could not load the job.' } };
  }
}

export async function listJobs(filters: JobFilter = {}, client?: SupabaseClient, signal?: AbortSignal): Promise<JobsResult> {
  const selected = serializeJobFilters(filters);
  if (selected.radiusKm && (selected.latitude === undefined || selected.longitude === undefined)) {
    return { data: [], error: { code: 'invalid-filter', message: 'A distance filter needs a location.' } };
  }
  try {
    const supabase = client ?? getSupabaseClient();
    const buildQuery = () => {
      let query = supabase.from('jobs').select('*').eq('status', 'active').order('updated_at', { ascending: false });
      if (signal) query = query.abortSignal(signal);
      if (selected.country) query = query.ilike('country', selected.country);
      if (selected.city) query = query.ilike('city', selected.city);
      if (selected.category) query = query.eq('category', selected.category);
      if (selected.jobType) query = query.eq('job_type', selected.jobType);
      if (selected.level) query = query.eq('level', selected.level);
      if (selected.tags?.length) query = query.overlaps('tags', selected.tags);
      if (selected.search) query = query.or(`title.ilike.%${selected.search}%,company.ilike.%${selected.search}%`);
      return query;
    };

    let query = buildQuery();
    let nationwideQuery: ReturnType<typeof buildQuery> | null = null;
    if (selected.latitude !== undefined && selected.longitude !== undefined && selected.radiusKm) {
      const box = serializeBoundingBox(selected.latitude, selected.longitude, selected.radiusKm);
      query = query.gte('latitude', box.latitude.gte).lte('latitude', box.latitude.lte).gte('longitude', box.longitude.gte).lte('longitude', box.longitude.lte);
      nationwideQuery = buildQuery().is('latitude', null).is('longitude', null);
    }
    const [coordinateResult, nationwideResult] = await Promise.all([query, nationwideQuery ?? Promise.resolve({ data: [], error: null })]);
    const error = coordinateResult.error ?? nationwideResult.error;
    if (error) return { data: [], error: { code: 'query', message: error.message || 'Could not load jobs.' } };
    const jobs = mergeJobs((coordinateResult.data ?? []).map((row) => fromRow(row as JobRow)), (nationwideResult.data ?? []).map((row) => fromRow(row as JobRow)));
    if (selected.radiusKm && selected.latitude !== undefined && selected.longitude !== undefined) {
      return { data: jobs.filter((job) => isWithinRadius(job, selected.latitude!, selected.longitude!, selected.radiusKm!)), error: null };
    }
    return { data: jobs, error: null };
  } catch (error) {
    return { data: [], error: { code: 'configuration', message: error instanceof Error ? error.message : 'Could not load jobs.' } };
  }
}
