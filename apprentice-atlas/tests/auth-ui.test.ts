import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const authForm = readFileSync(new URL('../src/components/auth/auth-form.tsx', import.meta.url), 'utf8');
const authScreen = readFileSync(new URL('../src/app/auth.tsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

describe('native auth and onboarding configuration', () => {
  it('uses the native Apple button and has no Google or password control', () => {
    expect(authForm).toContain('AppleAuthentication.AppleAuthenticationButton');
    expect(authForm).toContain('AppleAuthenticationButtonStyle.BLACK');
    expect(authForm).toContain('accessibilityState={appleControl.accessibilityState}');
    expect(authForm).toContain('appleControl.announceLoading');
    expect(authForm).not.toMatch(/Google/i);
    expect(authForm).not.toContain('secureTextEntry');
  });

  it('asks for language and search country before audience and interests', () => {
    const onboarding = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
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

  it('awaits async Apple completion and passes the continuation directly', () => {
    expect(authForm).toContain('onSuccess: () => void | Promise<void>');
    expect(authForm).toContain('await onSuccess()');
    expect(authScreen).toContain('onSuccess={complete}');
    expect(authScreen).not.toContain('onSuccess={() => void complete()}');
  });

  it('wires step-specific reset keys to both onboarding scroll modes', () => {
    const onboarding = readFileSync(new URL('../src/app/onboarding.tsx', import.meta.url), 'utf8');
    expect(onboarding).toContain("key={getOnboardingScrollKey('whole-page-scroll', step)}");
    expect(onboarding).toContain("key={getOnboardingScrollKey('contained', step)}");
  });
});
