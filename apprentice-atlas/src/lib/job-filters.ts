import type { Job, JobFilter } from '../types/jobs';

const EARTH_RADIUS_KM = 6371;

export function serializeJobFilters(filters: JobFilter = {}): JobFilter {
  const clean: JobFilter = { status: 'active' };
  if (filters.country?.trim()) clean.country = filters.country.trim();
  if (filters.city?.trim()) clean.city = filters.city.trim();
  if (filters.category?.trim()) clean.category = filters.category.trim();
  if (filters.jobType?.trim()) clean.jobType = filters.jobType.trim();
  if (filters.level?.trim()) clean.level = filters.level.trim();
  if (filters.search?.trim()) clean.search = filters.search.trim();
  if (filters.tags?.length) clean.tags = [...new Set(filters.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (Number.isFinite(filters.latitude)) clean.latitude = filters.latitude;
  if (Number.isFinite(filters.longitude)) clean.longitude = filters.longitude;
  if (Number.isFinite(filters.radiusKm) && (filters.radiusKm ?? 0) > 0) clean.radiusKm = filters.radiusKm;
  return clean;
}

export function getBoundingBox(latitude: number, longitude: number, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  return { minLatitude: latitude - latDelta, maxLatitude: latitude + latDelta, minLongitude: longitude - lonDelta, maxLongitude: longitude + lonDelta };
}

export function serializeBoundingBox(latitude: number, longitude: number, radiusKm: number) {
  const box = getBoundingBox(latitude, longitude, radiusKm);
  return {
    latitude: { gte: box.minLatitude, lte: box.maxLatitude },
    longitude: { gte: box.minLongitude, lte: box.maxLongitude },
  } as const;
}

export function hasMapPosition(job: Pick<Job, 'latitude' | 'longitude'>): job is Pick<Job, 'latitude' | 'longitude'> & { latitude: number; longitude: number } {
  return job.latitude !== null && job.longitude !== null;
}

export function mergeJobs<T extends { id: string }>(coordinateJobs: T[], nationwideJobs: T[]): T[] {
  return Array.from(new Map([...coordinateJobs, ...nationwideJobs].map((job) => [job.id, job])).values());
}

export function isWithinRadius(job: Pick<Job, 'latitude' | 'longitude'>, latitude: number, longitude: number, radiusKm: number): boolean {
  if (!hasMapPosition(job)) return true;
  const dLat = ((job.latitude - latitude) * Math.PI) / 180;
  const dLon = ((job.longitude - longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((latitude * Math.PI) / 180) * Math.cos((job.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) <= radiusKm;
}
