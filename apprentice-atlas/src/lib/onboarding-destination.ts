import { validatedPendingTrackJobId } from './application-flow';
import { isSafeReturnPath, validatedPendingSaveJobId } from './auth';

export type OnboardingContinuationParams = {
  returnTo?: string;
  pendingAction?: 'track' | 'save';
  jobId?: string;
};

type RawOnboardingParams = {
  returnTo?: unknown;
  pendingAction?: unknown;
  jobId?: unknown;
};

export type PostOnboardingDestination =
  | '/'
  | '/favorites'
  | '/atlas'
  | '/settings'
  | `/job/${string}`
  | {
      pathname: '/auth';
      params: Required<OnboardingContinuationParams>;
    };

function scalarParams(params: RawOnboardingParams) {
  return {
    returnTo: typeof params.returnTo === 'string' ? params.returnTo : undefined,
    pendingAction: typeof params.pendingAction === 'string' ? params.pendingAction : undefined,
    jobId: typeof params.jobId === 'string' ? params.jobId : undefined,
  };
}

function validatedAuthContinuation(params: RawOnboardingParams): Required<OnboardingContinuationParams> | null {
  const candidate = scalarParams(params);
  const trackJobId = validatedPendingTrackJobId(candidate);
  if (trackJobId) {
    return { returnTo: candidate.returnTo!, pendingAction: 'track', jobId: trackJobId };
  }
  const saveJobId = validatedPendingSaveJobId(candidate);
  if (saveJobId) {
    return { returnTo: candidate.returnTo!, pendingAction: 'save', jobId: saveJobId };
  }
  return null;
}

export function getOnboardingGateParams(
  pathname: string,
  params: RawOnboardingParams,
): OnboardingContinuationParams {
  if (isSafeReturnPath(pathname)) return { returnTo: pathname };
  if (pathname !== '/auth') return {};
  return validatedAuthContinuation(params) ?? {};
}

export function getPostOnboardingDestination(
  params: RawOnboardingParams,
  wasAlreadyComplete: boolean,
): PostOnboardingDestination {
  if (wasAlreadyComplete) return '/';

  const authContinuation = validatedAuthContinuation(params);
  if (authContinuation) return { pathname: '/auth', params: authContinuation };
  if (params.pendingAction !== undefined || params.jobId !== undefined) return '/';

  const { returnTo } = scalarParams(params);
  return isSafeReturnPath(returnTo) ? returnTo : '/';
}
