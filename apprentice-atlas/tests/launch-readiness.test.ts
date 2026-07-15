import { describe, expect, it } from 'vitest';

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
});
