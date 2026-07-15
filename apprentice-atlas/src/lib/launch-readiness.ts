export type LaunchReadiness = {
  bootstrapReady: boolean;
  discoveryReady: boolean;
  onboardingComplete: boolean;
  pathname: string;
};

export function shouldRevealLaunchContent({
  bootstrapReady,
  discoveryReady,
  onboardingComplete,
  pathname,
}: LaunchReadiness): boolean {
  if (!bootstrapReady) return false;
  if (!onboardingComplete) return pathname === '/onboarding';
  if (pathname === '/') return discoveryReady;
  return true;
}
