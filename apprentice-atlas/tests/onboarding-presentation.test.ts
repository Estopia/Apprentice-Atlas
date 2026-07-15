import { describe, expect, it } from 'vitest';

import { shouldEnableOnboardingScroll } from '../src/lib/onboarding-presentation';

describe('onboarding overflow presentation', () => {
  it.each([320, 375, 390, 430])('does not scroll fitting content at %d points wide', (width) => {
    expect(shouldEnableOnboardingScroll({ width, contentHeight: 540, viewportHeight: 620 })).toBe(false);
  });

  it('enables scrolling when compact content really overflows', () => {
    expect(shouldEnableOnboardingScroll({ width: 320, contentHeight: 581, viewportHeight: 560 })).toBe(true);
  });

  it('allows a one-pixel measurement tolerance', () => {
    expect(shouldEnableOnboardingScroll({ width: 390, contentHeight: 561, viewportHeight: 560 })).toBe(false);
    expect(shouldEnableOnboardingScroll({ width: 390, contentHeight: 561.01, viewportHeight: 560 })).toBe(true);
  });

  it('waits for valid layout measurements', () => {
    expect(shouldEnableOnboardingScroll({ width: 0, contentHeight: 700, viewportHeight: 0 })).toBe(false);
  });
});
