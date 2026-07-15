import { describe, expect, it } from 'vitest';

import {
  decideMapCameraSync,
  getDescriptionDisclosure,
  getDiscoveryLocationLabel,
  getJobAccessibilityLabel,
  getMapCameraIntent,
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
  it('uses measured rendered lines rather than character count for disclosure', () => {
    const shortNineLineText = 'A\nB\nC\nD\nE\nF\nG\nH\nI';
    const wideTwoLineText = 'A'.repeat(181);
    expect(shortNineLineText.length).toBeLessThan(181);
    expect(wideTwoLineText).toHaveLength(181);
    expect(getDescriptionDisclosure(shortNineLineText.split('\n').length, false)).toEqual({ collapsible: true, lineLimit: 8 });
    expect(getDescriptionDisclosure(2, false)).toEqual({ collapsible: false, lineLimit: undefined });
    expect(getDescriptionDisclosure(8, false)).toEqual({ collapsible: false, lineLimit: undefined });
    expect(getDescriptionDisclosure(9, true)).toEqual({ collapsible: true, lineLimit: undefined });
    expect(getDescriptionDisclosure(null, false)).toEqual({ collapsible: false, lineLimit: undefined });
  });
});
