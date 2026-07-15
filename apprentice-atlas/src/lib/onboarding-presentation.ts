import type { SingleFlightGate } from './single-flight-gate';

export type OnboardingLayoutMeasurement = {
  width: number;
  contentHeight: number;
  viewportHeight: number;
};

export type OnboardingLayoutMode = 'contained' | 'whole-page-scroll';

export type OnboardingTransition =
  | { kind: 'blocked' }
  | { kind: 'advance'; nextStep: number }
  | { kind: 'complete' };

const LAYOUT_TOLERANCE = 1;

export function getOnboardingLayoutMode({ height, fontScale }: {
  height: number;
  fontScale: number;
}): OnboardingLayoutMode {
  return height < 600 || fontScale >= 1.4 ? 'whole-page-scroll' : 'contained';
}

export function beginOnboardingTransition(
  gate: SingleFlightGate,
  { step, totalSteps, isValid, isSaving }: {
    step: number;
    totalSteps: number;
    isValid: boolean;
    isSaving: boolean;
  },
): OnboardingTransition {
  if (!isValid || isSaving || !gate.tryAcquire()) return { kind: 'blocked' };
  if (step < totalSteps - 1) return { kind: 'advance', nextStep: step + 1 };
  return { kind: 'complete' };
}

export function shouldEnableOnboardingScroll({
  width,
  contentHeight,
  viewportHeight,
}: OnboardingLayoutMeasurement): boolean {
  if (![width, contentHeight, viewportHeight].every(Number.isFinite)) return false;
  if (width <= 0 || contentHeight <= 0 || viewportHeight <= 0) return false;
  return contentHeight > viewportHeight + LAYOUT_TOLERANCE;
}
