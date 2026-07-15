import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getMapAreaSearchFilters, getMapSearchRadiusKm, getRenderableMapRegion } from '../src/lib/map-region';

const region = { latitude: 52.5, longitude: 13.4, latitudeDelta: 1, longitudeDelta: 1 };

describe('map area search', () => {
  it('covers the visible viewport instead of falling back to a fixed 50 km radius', () => {
    expect(getMapSearchRadiusKm(region)).toBe(66);
    expect(getMapSearchRadiusKm({ latitude: 54, longitude: -2, latitudeDelta: 10, longitudeDelta: 12 })).toBe(682);
  });

  it('uses the viewport centre and radius while preserving non-location filters', () => {
    expect(getMapAreaSearchFilters({ country: 'Germany', city: 'Berlin', radiusKm: 50, category: 'technology' }, region)).toEqual({
      country: undefined,
      city: undefined,
      latitude: 52.5,
      longitude: 13.4,
      radiusKm: 66,
      category: 'technology',
    });
  });

  it('keeps the searched map visible when refreshed results contain no positioned jobs', () => {
    expect(getRenderableMapRegion(null, region)).toEqual(region);
    expect(getRenderableMapRegion(null, null)).toBeNull();
  });

  it('passes the complete native region through the map and wires it into area search', () => {
    const map = readFileSync('src/components/map/job-map.tsx', 'utf8');
    const discovery = readFileSync('src/app/(tabs)/map.tsx', 'utf8');
    expect(map).toContain('onRegionChange?.(next)');
    expect(discovery).toContain('getMapAreaSearchFilters(filters, mapViewport)');
    expect(discovery).not.toMatch(/radiusKm: filters\.radiusKm \?\? 50/);
  });
});
