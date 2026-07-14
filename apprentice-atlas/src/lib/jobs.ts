import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabase';
import type { Job, JobFilter } from '../types/jobs';
import { getBoundingBox, hasMapPosition, serializeJobFilters } from './job-filters';

export { getBoundingBox, hasMapPosition, serializeJobFilters } from './job-filters';

export type JobsError = { code: 'configuration' | 'query' | 'invalid-filter'; message: string };
export type JobsResult = { data: Job[]; error: JobsError | null };

type JobRow = {
  id: string; title: string; company: string; country: string; city: string;
  latitude: number | null; longitude: number | null; job_type: string; level: string;
  category: string; tags: string[] | null; raw_description: string; requirements: string[] | null;
  source_url: string; source_name: string; status: Job['status']; last_seen_at: string;
  expires_at: string | null; created_at: string; updated_at: string;
};

const EARTH_RADIUS_KM = 6371;

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function fromRow(row: JobRow): Job {
  return {
    id: row.id, title: row.title, company: row.company, country: row.country, city: row.city,
    latitude: row.latitude, longitude: row.longitude, jobType: row.job_type, level: row.level,
    category: row.category, tags: row.tags ?? [], rawDescription: row.raw_description,
    requirements: row.requirements ?? [], sourceUrl: row.source_url, sourceName: row.source_name,
    status: row.status, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listJobs(filters: JobFilter = {}, client?: SupabaseClient): Promise<JobsResult> {
  const selected = serializeJobFilters(filters);
  if (selected.radiusKm && (selected.latitude === undefined || selected.longitude === undefined)) {
    return { data: [], error: { code: 'invalid-filter', message: 'A distance filter needs a location.' } };
  }
  try {
    const supabase = client ?? getSupabaseClient();
    let query = supabase.from('jobs').select('*').eq('status', 'active').order('updated_at', { ascending: false });
    if (selected.country) query = query.ilike('country', selected.country);
    if (selected.city) query = query.ilike('city', selected.city);
    if (selected.category) query = query.eq('category', selected.category);
    if (selected.jobType) query = query.eq('job_type', selected.jobType);
    if (selected.level) query = query.eq('level', selected.level);
    if (selected.tags?.length) query = query.overlaps('tags', selected.tags);
    if (selected.search) query = query.or(`title.ilike.%${selected.search}%,company.ilike.%${selected.search}%`);
    if (selected.latitude !== undefined && selected.longitude !== undefined && selected.radiusKm) {
      const box = getBoundingBox(selected.latitude, selected.longitude, selected.radiusKm);
      query = query.gte('latitude', box.minLatitude).lte('latitude', box.maxLatitude).gte('longitude', box.minLongitude).lte('longitude', box.maxLongitude);
    }
    const { data, error } = await query;
    if (error) return { data: [], error: { code: 'query', message: error.message || 'Could not load jobs.' } };
    let jobs = (data as JobRow[]).map(fromRow);
    if (selected.radiusKm && selected.latitude !== undefined && selected.longitude !== undefined) {
      jobs = jobs.filter((job) => !hasMapPosition(job) || distanceKm(selected.latitude!, selected.longitude!, job.latitude, job.longitude) <= selected.radiusKm!);
    }
    return { data: jobs, error: null };
  } catch (error) {
    return { data: [], error: { code: 'configuration', message: error instanceof Error ? error.message : 'Could not load jobs.' } };
  }
}
