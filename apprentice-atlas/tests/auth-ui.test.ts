import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const authForm = readFileSync(new URL('../src/components/auth/auth-form.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

describe('native auth and onboarding configuration', () => {
  it('uses the native Apple button and has no Google or password control', () => {
    expect(authForm).toContain('AppleAuthentication.AppleAuthenticationButton');
    expect(authForm).toContain('AppleAuthenticationButtonStyle.BLACK');
    expect(authForm).not.toMatch(/Google/i);
    expect(authForm).not.toContain('secureTextEntry');
  });

  it('keeps onboarding chrome stable and scrolls only measured overflow', () => {
    expect(onboarding).not.toContain('minHeight: height');
    expect(onboarding).toContain('scrollEnabled={contentOverflows}');
    expect(onboarding).toMatch(/onContentSizeChange=\{\(_, \w+\) => setContentMeasurement\(\{ step, height: \w+ \}\)\}/);
    expect(onboarding).toContain('onLayout={(event) =>');

    const scrollEnd = onboarding.indexOf('</ScrollView>');
    const footer = onboarding.indexOf('<View style={styles.footer}>');
    expect(scrollEnd).toBeGreaterThan(0);
    expect(footer).toBeGreaterThan(scrollEnd);
  });

  it('asks for language and search country before audience and interests', () => {
    const languageStep = onboarding.indexOf("{step === 0 && (");
    const audienceStep = onboarding.indexOf("{step === 1 && (");
    const interestsStep = onboarding.indexOf("{step === 2 && (");

    expect(onboarding.slice(languageStep, audienceStep)).toContain('onboarding.countryLanguageTitle');
    expect(onboarding.slice(languageStep, audienceStep)).toContain('onboarding.language');
    expect(onboarding.slice(audienceStep, interestsStep)).toContain('onboarding.audienceTitle');
    expect(onboarding.slice(interestsStep)).toContain('onboarding.interestsTitle');
  });

  it('enables the native Sign in with Apple entitlement and config plugin', () => {
    expect(appConfig.expo.ios.usesAppleSignIn).toBe(true);
    expect(appConfig.expo.plugins).toContain('expo-apple-authentication');
  });

  it('uses one native stack close affordance and a full-bleed white auth surface', () => {
    const authScreen = readFileSync(new URL('../src/app/auth.tsx', import.meta.url), 'utf8');
    expect(authScreen).not.toContain('<Stack.Toolbar');
    expect(authScreen).not.toContain('styles.close');
    expect(authScreen).not.toContain('router.back()');
    expect(authScreen).toContain("headerBackButtonDisplayMode: 'minimal'");
    expect(authScreen).toMatch(/screen: \{ flex: 1, backgroundColor: Palette\.white \}/);
    expect(authScreen).not.toContain('formGroup: { backgroundColor: Palette.white');
  });
});
