import type { Job } from '@/types/jobs';
import type { JobMapRegion } from './map-region';

export type PositionedJob = Job & { latitude: number; longitude: number };
export type JobCluster = { id: string; latitude: number; longitude: number; jobs: PositionedJob[] };

export function clusterJobsForRegion(jobs: PositionedJob[], region: JobMapRegion): JobCluster[] {
  const columns = 6;
  const rows = 9;
  const cellLatitude = Math.max(region.latitudeDelta / rows, 0.004);
  const cellLongitude = Math.max(region.longitudeDelta / columns, 0.004);
  const minLatitude = region.latitude - region.latitudeDelta * 0.62;
  const maxLatitude = region.latitude + region.latitudeDelta * 0.62;
  const minLongitude = region.longitude - region.longitudeDelta * 0.62;
  const maxLongitude = region.longitude + region.longitudeDelta * 0.62;
  const buckets = new Map<string, PositionedJob[]>();

  for (const job of jobs) {
    if (job.latitude < minLatitude || job.latitude > maxLatitude || job.longitude < minLongitude || job.longitude > maxLongitude) continue;
    const column = Math.floor((job.longitude - minLongitude) / cellLongitude);
    const row = Math.floor((job.latitude - minLatitude) / cellLatitude);
    const key = `${column}:${row}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(job);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()].map(([id, bucket]) => ({
    id,
    jobs: bucket,
    latitude: bucket.reduce((sum, job) => sum + job.latitude, 0) / bucket.length,
    longitude: bucket.reduce((sum, job) => sum + job.longitude, 0) / bucket.length,
  }));
}
