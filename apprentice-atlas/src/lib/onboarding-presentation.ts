export type OnboardingLayoutMeasurement = {
  width: number;
  contentHeight: number;
  viewportHeight: number;
};

const LAYOUT_TOLERANCE = 1;

export function shouldEnableOnboardingScroll({
  width,
  contentHeight,
  viewportHeight,
}: OnboardingLayoutMeasurement): boolean {
  if (![width, contentHeight, viewportHeight].every(Number.isFinite)) return false;
  if (width <= 0 || contentHeight <= 0 || viewportHeight <= 0) return false;
  return contentHeight > viewportHeight + LAYOUT_TOLERANCE;
}
