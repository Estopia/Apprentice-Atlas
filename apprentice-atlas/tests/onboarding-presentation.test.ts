import { describe, expect, it } from 'vitest';

import { createSingleFlightGate } from '../src/lib/single-flight-gate';
import {
  beginOnboardingTransition,
  getOnboardingLayoutMode,
  shouldEnableOnboardingScroll,
} from '../src/lib/onboarding-presentation';

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

describe('onboarding layout mode', () => {
  it.each([667, 844, 932])('keeps fixed chrome on a typical %d-point portrait height', (height) => {
    expect(getOnboardingLayoutMode({ height, fontScale: 1 })).toBe('contained');
  });

  it('uses whole-page scrolling for short landscape layouts', () => {
    expect(getOnboardingLayoutMode({ height: 430, fontScale: 1 })).toBe('whole-page-scroll');
  });

  it('uses whole-page scrolling for accessibility text sizes', () => {
    expect(getOnboardingLayoutMode({ height: 844, fontScale: 1.5 })).toBe('whole-page-scroll');
  });
});

describe('onboarding transition gate', () => {
  it('returns an explicit next step and blocks rapid duplicate Next', () => {
    const gate = createSingleFlightGate();

    expect(beginOnboardingTransition(gate, { step: 0, totalSteps: 3, isValid: true, isSaving: false })).toEqual({
      kind: 'advance',
      nextStep: 1,
    });
    expect(beginOnboardingTransition(gate, { step: 0, totalSteps: 3, isValid: true, isSaving: false })).toEqual({ kind: 'blocked' });

    gate.release();
    expect(beginOnboardingTransition(gate, { step: 1, totalSteps: 3, isValid: true, isSaving: false })).toEqual({
      kind: 'advance',
      nextStep: 2,
    });
  });

  it('allows only one final completion until persistence releases the gate', () => {
    const gate = createSingleFlightGate();

    expect(beginOnboardingTransition(gate, { step: 2, totalSteps: 3, isValid: true, isSaving: false })).toEqual({ kind: 'complete' });
    expect(beginOnboardingTransition(gate, { step: 2, totalSteps: 3, isValid: true, isSaving: false })).toEqual({ kind: 'blocked' });
    gate.release();
    expect(beginOnboardingTransition(gate, { step: 2, totalSteps: 3, isValid: true, isSaving: false })).toEqual({ kind: 'complete' });
  });

  it('does not acquire the gate for invalid or already-saving transitions', () => {
    const gate = createSingleFlightGate();
    expect(beginOnboardingTransition(gate, { step: 0, totalSteps: 3, isValid: false, isSaving: false })).toEqual({ kind: 'blocked' });
    expect(beginOnboardingTransition(gate, { step: 2, totalSteps: 3, isValid: true, isSaving: true })).toEqual({ kind: 'blocked' });
    expect(gate.tryAcquire()).toBe(true);
  });
});
