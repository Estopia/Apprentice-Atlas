import { hasMapPosition } from './job-filters';
import type { Job } from '../types/jobs';

export type JobMapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

const REGION_REFRESH_THRESHOLD = 0.12;

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
