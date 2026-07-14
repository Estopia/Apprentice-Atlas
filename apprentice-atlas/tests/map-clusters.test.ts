import { describe, expect, it } from 'vitest';

import { clusterJobsForRegion, type PositionedJob } from '../src/lib/map-clusters';

const job = (id: string, latitude: number, longitude: number) => ({ id, latitude, longitude } as PositionedJob);
const region = { latitude: 51.5, longitude: -0.1, latitudeDelta: 1, longitudeDelta: 1 };

describe('map marker clustering', () => {
  it('combines nearby jobs while preserving isolated jobs', () => {
    const clusters = clusterJobsForRegion([job('a', 51.5, -0.1), job('b', 51.51, -0.09), job('c', 51.9, 0.3)], region);
    expect(clusters.map((cluster) => cluster.jobs.map((item) => item.id).sort())).toContainEqual(['a', 'b']);
    expect(clusters.some((cluster) => cluster.jobs.length === 1 && cluster.jobs[0].id === 'c')).toBe(true);
  });

  it('does not render distant jobs outside the visible map margin', () => {
    expect(clusterJobsForRegion([job('visible', 51.5, -0.1), job('far', 55, -4)], region).flatMap((cluster) => cluster.jobs).map((item) => item.id)).toEqual(['visible']);
  });
});
