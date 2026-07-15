import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('App Store readiness contracts', () => {
  it('declares no tracking and all required-reason API categories used by native dependencies', () => {
    const config = JSON.parse(read('app.json')).expo.ios.privacyManifests;
    expect(config.NSPrivacyTracking).toBe(false);
    expect(config.NSPrivacyTrackingDomains).toEqual([]);
    const categories = config.NSPrivacyAccessedAPITypes.map((entry: { NSPrivacyAccessedAPIType: string }) => entry.NSPrivacyAccessedAPIType);
    expect(categories).toEqual(expect.arrayContaining([
      'NSPrivacyAccessedAPICategoryFileTimestamp',
      'NSPrivacyAccessedAPICategoryDiskSpace',
      'NSPrivacyAccessedAPICategoryUserDefaults',
      'NSPrivacyAccessedAPICategorySystemBootTime',
    ]));
  });

  it('declares the account, location, notes, and saved activity used by the app', () => {
    const config = JSON.parse(read('app.json')).expo.ios.privacyManifests;
    const types = config.NSPrivacyCollectedDataTypes.map((entry: { NSPrivacyCollectedDataType: string }) => entry.NSPrivacyCollectedDataType);
    expect(types).toEqual(expect.arrayContaining([
      'NSPrivacyCollectedDataTypeEmailAddress', 'NSPrivacyCollectedDataTypeUserID',
      'NSPrivacyCollectedDataTypePreciseLocation', 'NSPrivacyCollectedDataTypeOtherUserContent',
      'NSPrivacyCollectedDataTypeProductInteraction',
    ]));
  });

  it('offers privacy, terms, legal notice, support, export, and in-app account deletion from Settings', () => {
    const settings = read('src/app/settings.tsx');
    expect(settings).toMatch(/settings\.privacy/);
    expect(settings).toMatch(/settings\.terms/);
    expect(settings).toMatch(/settings\.imprint/);
    expect(settings).toContain('mailto:hello@estopia.net');
    expect(settings).toMatch(/exportData/);
    expect(settings).toMatch(/deleteAccount/);
  });
});
