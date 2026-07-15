import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const home = readFileSync('src/app/(tabs)/index.tsx', 'utf8');

describe('adaptive home screen', () => {
  it('combines personalized recommendations, next action, nearby roles, and deadlines', () => {
    expect(home).toContain('rankHomeJobs');
    expect(home).toContain('deriveAtlasNextAction');
    expect(home).toContain('selectUpcomingDeadlines');
    expect(home).toContain('getHomeJobDistanceKm');
    expect(home).toContain("filters.country ?? preferences.country ?? 'Germany'");
  });

  it('provides the primary search, map, settings, job, and application routes', () => {
    expect(home).toContain("router.push('/search')");
    expect(home).toContain("pathname: '/map'");
    expect(home).toContain("router.push('/settings')");
    expect(home).toContain("pathname: '/job/[id]'");
    expect(home).toContain("pathname: '/application/[jobId]'");
  });

  it('uses dense, useful home modules instead of isolated oversized cards', () => {
    expect(home).toContain('SnapshotStrip');
    expect(home).toContain('InterestRail');
    expect(home).toContain('NearbyPreview');
    expect(home).toContain('activeApplications.length');
  });

  it('marks the initial content ready without waiting for the map tab', () => {
    expect(home).toContain('markDiscoveryReady');
    expect(home).toContain('if (!loading) markDiscoveryReady()');
  });
});
