import { describe, expect, it } from 'vitest';

import {
  decideMapCameraSync,
  getDescriptionLineLimit,
  getDiscoveryLocationLabel,
  getJobAccessibilityLabel,
  getMapCameraIntent,
  prepareJobDescription,
  type MapCameraSyncInput,
  type MapCameraSyncState,
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

  it('waits for results matching a new camera intent and ignores routine refreshes', () => {
    let state: MapCameraSyncState = {
      observedIntent: null,
      appliedIntent: null,
      pendingIntent: null,
      pendingResultIdentity: null,
      sawLoading: false,
    };
    const step = (input: MapCameraSyncInput) => {
      const decision = decideMapCameraSync(state, input);
      state = decision.state;
      return decision.apply;
    };

    expect(step({ intent: 'country:germany', resultIdentity: 'region:germany', loading: false })).toBe(true);
    expect(step({ intent: 'country:united kingdom', resultIdentity: 'region:germany', loading: false })).toBe(false);
    expect(step({ intent: 'country:united kingdom', resultIdentity: 'region:germany', loading: true })).toBe(false);
    expect(step({ intent: 'country:united kingdom', resultIdentity: 'region:uk', loading: false })).toBe(true);
    expect(step({ intent: 'country:united kingdom', resultIdentity: 'region:uk', loading: true })).toBe(false);
    expect(step({ intent: 'country:united kingdom', resultIdentity: 'region:uk-refreshed', loading: false })).toBe(false);
  });

  it('builds localized marker accessibility labels', () => {
    const job = { title: 'Software Apprentice', company: 'Atlas GmbH', city: 'Berlin', country: 'Germany' };
    expect(getJobAccessibilityLabel('de', job)).toBe('Software Apprentice, Atlas GmbH, Berlin, Deutschland');
    expect(getJobAccessibilityLabel('en', job)).toBe('Software Apprentice, Atlas GmbH, Berlin, Germany');
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
    expect(prepareJobDescription('A'.repeat(181)).collapsible).toBe(true);
  });

  it('only applies an eight-line limit while a collapsible listing is collapsed', () => {
    expect(getDescriptionLineLimit(false, false)).toBeUndefined();
    expect(getDescriptionLineLimit(true, false)).toBe(8);
    expect(getDescriptionLineLimit(true, true)).toBeUndefined();
  });
});
