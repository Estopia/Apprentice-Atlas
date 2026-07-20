import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('App Store readiness contracts', () => {
  it('builds Expo iOS modules from one source-compatible dependency set', () => {
    const profiles = JSON.parse(read('eas.json')).build as Record<string, { env?: Record<string, string> }>;

    for (const profile of ['development', 'preview', 'production']) {
      expect(profiles[profile]?.env?.EXPO_USE_PRECOMPILED_MODULES).toBe('0');
    }
  });

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
    const legal = read('src/lib/legal.ts');
    expect(settings).toMatch(/settings\.privacy/);
    expect(settings).toMatch(/settings\.terms/);
    expect(settings).toMatch(/settings\.imprint/);
    expect(settings).toContain('LEGAL_URLS.privacy');
    expect(settings).toContain('LEGAL_URLS.terms');
    expect(legal).toContain('https://apprenticeatlas.com/privacy');
    expect(legal).toContain('https://apprenticeatlas.com/tos');
    expect(settings).toContain('mailto:hello@estopia.net');
    expect(settings).toMatch(/exportData/);
    expect(settings).toMatch(/deleteAccount/);
  });

  it('documents preparation, device-local state, calendar handoff, share assets, and PDF export in both legal locales', () => {
    const legal = read('src/lib/legal.ts');
    for (const phrase of [
      'store: false',
      'lokaler Entwurf',
      'local draft',
      'Benachrichtigungs-IDs',
      'notification identifiers',
      'Kalender',
      'calendar',
      'Share-Grafiken',
      'share images',
      'PDF-Export',
      'PDF export',
    ]) expect(legal).toContain(phrase);
  });

  it('registers a share preview route and opens it from job detail', () => {
    const layout = read('src/app/_layout.tsx');
    const detail = read('src/app/job/[id].tsx');
    const preview = read('src/app/share/[jobId].tsx');

    expect(layout).toContain('<Stack.Screen name="share/[jobId]"');
    expect(detail).toContain("pathname: '/share/[jobId]'");
    expect(detail).not.toContain('Share.share({ title: job.title');
    expect(preview).toContain("from 'react-native-view-shot'");
    expect(preview).toContain("from 'expo-sharing'");
    expect(preview).toMatch(/width:\s*SHARE_CARD_WIDTH/);
    expect(preview).toMatch(/height:\s*SHARE_CARD_HEIGHT/);
    expect(preview).toContain("mimeType: 'image/png'");
  });

  it('uses native PDF generation and sharing while retaining the JSON export', () => {
    const settings = read('src/app/settings.tsx');
    expect(settings).toContain("from 'expo-print'");
    expect(settings).toContain("from 'expo-sharing'");
    expect(settings).toContain('printToFileAsync');
    expect(settings).toContain("mimeType: 'application/pdf'");
    expect(settings).toContain('JSON.stringify(data, null, 2)');
    expect(settings).toContain("Platform.OS === 'web'");
  });
});
