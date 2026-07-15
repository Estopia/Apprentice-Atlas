import { describe, expect, it } from 'vitest';

import { getFirstRunDeviceDefaults } from '../src/lib/device-preferences';

describe('first-run device defaults', () => {
  it('uses the supported phone language and matching search country', () => {
    expect(getFirstRunDeviceDefaults([{ languageCode: 'de', regionCode: 'DE' }])).toEqual({
      locale: 'de',
      country: 'Germany',
    });
    expect(getFirstRunDeviceDefaults([{ languageCode: 'en', regionCode: 'GB' }])).toEqual({
      locale: 'en',
      country: 'United Kingdom',
    });
  });

  it('keeps phone language and device region as separate choices', () => {
    expect(getFirstRunDeviceDefaults([{ languageCode: 'en', regionCode: 'DE' }])).toEqual({
      locale: 'en',
      country: 'Germany',
    });
    expect(getFirstRunDeviceDefaults([{ languageCode: 'de', regionCode: 'GB' }])).toEqual({
      locale: 'de',
      country: 'United Kingdom',
    });
  });

  it('falls back by region for unsupported languages and otherwise uses English', () => {
    expect(getFirstRunDeviceDefaults([{ languageCode: 'fr', regionCode: 'DE' }])).toEqual({
      locale: 'de',
      country: 'Germany',
    });
    expect(getFirstRunDeviceDefaults([{ languageCode: 'fr', regionCode: 'FR' }])).toEqual({
      locale: 'en',
      country: null,
    });
    expect(getFirstRunDeviceDefaults([])).toEqual({ locale: 'en', country: null });
  });
});
