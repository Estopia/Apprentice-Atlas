import { describe, expect, it } from 'vitest';

import { localizeJobError, t } from '../src/lib/i18n';
import { getBoundingBox, hasMapPosition, isWithinRadius, mergeJobs, serializeBoundingBox } from '../src/lib/job-filters';

describe('discovery client helpers', () => {
  it('serializes a radius bbox into safe latitude and longitude ranges', () => {
    const box = getBoundingBox(52.52, 13.405, 25);
    expect(serializeBoundingBox(52.52, 13.405, 25)).toEqual({
      latitude: { gte: box.minLatitude, lte: box.maxLatitude },
      longitude: { gte: box.minLongitude, lte: box.maxLongitude },
    });
  });

  it('retains nationwide jobs while filtering coordinate jobs by radius and deduplicates merges', () => {
    const nearby = { id: 'nearby', latitude: 52.52, longitude: 13.405 };
    const farAway = { id: 'far', latitude: 48.13, longitude: 11.58 };
    const nationwide = { id: 'nationwide', latitude: null, longitude: null };
    expect(isWithinRadius(nearby, 52.52, 13.405, 25)).toBe(true);
    expect(isWithinRadius(farAway, 52.52, 13.405, 25)).toBe(false);
    expect(isWithinRadius(nationwide, 52.52, 13.405, 25)).toBe(true);
    expect(mergeJobs([nearby, nationwide], [nationwide])).toEqual([nearby, nationwide]);
  });

  it('maps backend error codes and visible map labels through the active locale', () => {
    expect(localizeJobError('de', 'query')).toContain('Ausbildungen');
    expect(localizeJobError('en', 'invalid-filter')).toContain('distance');
    expect(t('de', 'map.noPositions')).toContain('Kartenposition');
    expect(t('en', 'tabs.discover')).toBe('Discover');
  });

  it('only treats complete coordinates as marker positions', () => {
    expect(hasMapPosition({ latitude: null, longitude: null })).toBe(false);
    expect(hasMapPosition({ latitude: 52.52, longitude: 13.405 })).toBe(true);
  });
});
