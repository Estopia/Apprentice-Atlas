import { describe, expect, it } from 'vitest';

import {
  getDiscoveryLocationLabel,
  getMapCameraIntent,
  prepareJobDescription,
  shouldUpdateMapCamera,
} from '../src/lib/discovery-presentation';
import { t } from '../src/lib/i18n';

describe('discovery presentation', () => {
  it('keeps top controls short and localizes country-only locations', () => {
    expect(t('de', 'discovery.filtersShort')).toBe('Filter');
    expect(t('en', 'discovery.filtersShort')).toBe('Filters');
    expect(getDiscoveryLocationLabel('de', {})).toBe('Standort');
    expect(getDiscoveryLocationLabel('de', { country: 'Germany' })).toBe('Deutschland');
    expect(getDiscoveryLocationLabel('de', { country: 'United Kingdom' })).toBe('Vereinigtes Königreich');
    expect(getDiscoveryLocationLabel('en', { country: 'Germany' })).toBe('Germany');
    expect(getDiscoveryLocationLabel('en', { city: 'Berlin', country: 'Germany' })).toBe('Berlin');
  });

  it('derives camera intent only from explicit location search state', () => {
    const initial = getMapCameraIntent({ country: 'Germany', search: 'developer' });
    const refreshedResults = getMapCameraIntent({ country: 'Germany', search: 'designer', category: 'technology' });
    const changedLocation = getMapCameraIntent({ city: 'Berlin', country: 'Germany' });
    const searchedMapArea = getMapCameraIntent({ latitude: 52.52, longitude: 13.405, radiusKm: 25 });

    expect(refreshedResults).toBe(initial);
    expect(changedLocation).not.toBe(initial);
    expect(searchedMapArea).not.toBe(changedLocation);
  });

  it('recenters once initially and later only when explicit camera intent changes', () => {
    expect(shouldUpdateMapCamera(null, 'country:germany', true)).toBe(true);
    expect(shouldUpdateMapCamera('country:germany', 'country:germany', true)).toBe(false);
    expect(shouldUpdateMapCamera('country:germany', 'city:berlin|country:germany', true)).toBe(true);
    expect(shouldUpdateMapCamera('country:germany', 'city:berlin|country:germany', false)).toBe(false);
  });
});

describe('job detail presentation', () => {
  it('cleans visible Markdown while preserving readable structure', () => {
    expect(prepareJobDescription('**What you will do**\n\n- Learn *modern* tools').text).toBe(
      'What you will do\n\n• Learn modern tools',
    );
  });

  it('only collapses genuinely long original listings', () => {
    expect(prepareJobDescription('A short and useful description.').collapsible).toBe(false);
    expect(prepareJobDescription('A'.repeat(700)).collapsible).toBe(true);
  });
});
