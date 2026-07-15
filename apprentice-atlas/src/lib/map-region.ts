import { hasMapPosition } from './job-filters';
import type { Job, JobFilter } from '../types/jobs';

export type JobMapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const REGION_REFRESH_THRESHOLD = 0.12;
const KM_PER_LATITUDE_DEGREE = 111.32;

export function getMapSearchRadiusKm(region: JobMapRegion): number {
  const halfLatitudeKm = Math.abs(region.latitudeDelta) * 0.5 * KM_PER_LATITUDE_DEGREE;
  const longitudeScale = Math.max(Math.cos((region.latitude * Math.PI) / 180), 0.01);
  const halfLongitudeKm = Math.abs(region.longitudeDelta) * 0.5 * KM_PER_LATITUDE_DEGREE * longitudeScale;
  return Math.ceil(Math.max(5, Math.hypot(halfLatitudeKm, halfLongitudeKm)));
}

export function getMapAreaSearchFilters(filters: JobFilter, region: JobMapRegion): JobFilter {
  return {
    ...filters,
    country: undefined,
    city: undefined,
    latitude: region.latitude,
    longitude: region.longitude,
    radiusKm: getMapSearchRadiusKm(region),
  };
}

export function getRenderableMapRegion(resultRegion: JobMapRegion | null, visibleRegion: JobMapRegion | null): JobMapRegion | null {
  return resultRegion ?? visibleRegion;
}

export function hasMeaningfulRegionChange(previous: JobMapRegion, next: JobMapRegion): boolean {
  const latitudeSpan = Math.max(previous.latitudeDelta, 0.000001);
  const longitudeSpan = Math.max(previous.longitudeDelta, 0.000001);
  const latitudeShift = Math.abs(next.latitude - previous.latitude) / latitudeSpan;
  const longitudeShift = Math.abs(next.longitude - previous.longitude) / longitudeSpan;
  const latitudeZoom = Math.abs(next.latitudeDelta - previous.latitudeDelta) / latitudeSpan;
  const longitudeZoom = Math.abs(next.longitudeDelta - previous.longitudeDelta) / longitudeSpan;
  return Math.max(latitudeShift, longitudeShift, latitudeZoom, longitudeZoom) >= REGION_REFRESH_THRESHOLD;
}

export function getJobsMapRegion(jobs: Pick<Job, 'latitude' | 'longitude'>[]): JobMapRegion | null {
  const positioned = jobs.filter(hasMapPosition);
  if (!positioned.length) return null;
  const latitudes = positioned.map((job) => job.latitude);
  const longitudes = positioned.map((job) => job.longitude);
  const latitudeDelta = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.08) * 1.35;
  const longitudeDelta = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.08) * 1.35;
  return { latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2, longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2, latitudeDelta, longitudeDelta };
}
