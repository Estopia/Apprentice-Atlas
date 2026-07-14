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

  it('lets onboarding fill the viewport without an artificial oversized minimum', () => {
    expect(onboarding).toContain('minHeight: height');
    expect(onboarding).toContain('contentInsetAdjustmentBehavior="never"');
    expect(onboarding).not.toContain('Math.max(680');
  });

  it('enables the native Sign in with Apple entitlement and config plugin', () => {
    expect(appConfig.expo.ios.usesAppleSignIn).toBe(true);
    expect(appConfig.expo.plugins).toContain('expo-apple-authentication');
  });
});
