import type { JobFilter } from '../../../src/types/jobs.ts';

export function normalizeJobFilters(filter: JobFilter): JobFilter {
  const result: JobFilter = {};
  for (const key of ['country', 'city', 'category', 'jobType', 'level', 'search'] as const) {
    const value = filter[key];
    if (typeof value === 'string' && value.trim()) result[key] = value.trim();
  }
  if (filter.status) result.status = filter.status;
  if (Array.isArray(filter.tags)) {
    const tags = filter.tags.map((tag) => tag.trim()).filter(Boolean);
    if (tags.length) result.tags = tags;
  }
  const latitude = typeof filter.latitude === 'number' && Number.isFinite(filter.latitude) ? filter.latitude : undefined;
  const longitude = typeof filter.longitude === 'number' && Number.isFinite(filter.longitude) ? filter.longitude : undefined;
  const radiusKm = typeof filter.radiusKm === 'number' && Number.isFinite(filter.radiusKm) && filter.radiusKm > 0 ? filter.radiusKm : undefined;
  if (latitude !== undefined && longitude !== undefined) {
    result.latitude = latitude;
    result.longitude = longitude;
    if (radiusKm !== undefined) result.radiusKm = radiusKm;
  }
  return result;
}

export function serializeJobFilters(filter: JobFilter): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalizeJobFilters(filter))) {
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params;
}
