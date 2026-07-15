import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { shouldRevealLaunchContent } from '../src/lib/launch-readiness';

describe('launch readiness', () => {
  it('keeps the launch cover visible until local bootstrap has finished', () => {
    expect(shouldRevealLaunchContent({
      bootstrapReady: false,
      discoveryReady: false,
      onboardingComplete: true,
      pathname: '/',
    })).toBe(false);
  });

  it('waits for the onboarding redirect before revealing a first launch', () => {
    expect(shouldRevealLaunchContent({
      bootstrapReady: true,
      discoveryReady: false,
      onboardingComplete: false,
      pathname: '/',
    })).toBe(false);
    expect(shouldRevealLaunchContent({
      bootstrapReady: true,
      discoveryReady: false,
      onboardingComplete: false,
      pathname: '/onboarding',
    })).toBe(true);
  });

  it('waits for the first discovery result and map surface on the home route', () => {
    expect(shouldRevealLaunchContent({
      bootstrapReady: true,
      discoveryReady: false,
      onboardingComplete: true,
      pathname: '/',
    })).toBe(false);
    expect(shouldRevealLaunchContent({
      bootstrapReady: true,
      discoveryReady: true,
      onboardingComplete: true,
      pathname: '/',
    })).toBe(true);
  });

  it('does not hold deep links or non-discovery tabs behind map readiness', () => {
    for (const pathname of ['/job/example', '/favorites', '/atlas', '/settings']) {
      expect(shouldRevealLaunchContent({
        bootstrapReady: true,
        discoveryReady: false,
        onboardingComplete: true,
        pathname,
      })).toBe(true);
    }
  });

  it('uses the supplied white-fill Lottie on a full brand-blue launch surface', () => {
    const root = resolve(import.meta.dirname, '..');
    const source = readFileSync(resolve(root, 'src/components/launch/launch-gate.tsx'), 'utf8');
    const appConfig = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')) as {
      expo: { plugins: (string | [string, Record<string, unknown>])[] };
    };
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const splashPlugin = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');

    expect(packageJson.dependencies['lottie-react-native']).toBeTruthy();
    expect(source).toContain("from 'lottie-react-native'");
    expect(source).toContain("require('../../../assets/logo-loading.json')");
    expect(source).toContain('onAnimationFinish');
    expect(splashPlugin).toEqual(['expo-splash-screen', { backgroundColor: '#155EEF' }]);
  });
});
