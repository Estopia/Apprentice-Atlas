import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ApplicationStatus } from '@/types/jobs';

export const REVIEW_PROMPT_VERSION_KEY = 'apprentice-atlas:review-prompt-version';

let reviewQueue: Promise<unknown> = Promise.resolve();

export function shouldRequestAppReview(
  previousStatus: ApplicationStatus | null,
  nextStatus: ApplicationStatus,
  appVersion: string,
  lastPromptedVersion: string | null,
): boolean {
  return previousStatus !== null
    && previousStatus !== 'offer'
    && nextStatus === 'offer'
    && appVersion.trim().length > 0
    && lastPromptedVersion !== appVersion;
}

async function requestAppReview(
  previousStatus: ApplicationStatus | null,
  nextStatus: ApplicationStatus,
  suppliedVersion?: string,
): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return false;

  try {
    const appVersion = suppliedVersion
      ?? (await import('expo-constants')).default.expoConfig?.version
      ?? '';
    const lastPromptedVersion = await AsyncStorage.getItem(REVIEW_PROMPT_VERSION_KEY);

    if (!shouldRequestAppReview(previousStatus, nextStatus, appVersion, lastPromptedVersion)) {
      return false;
    }

    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return false;

    // Persist before invoking StoreKit so retries cannot prompt twice if the native call fails.
    await AsyncStorage.setItem(REVIEW_PROMPT_VERSION_KEY, appVersion);
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

export function requestAppReviewAfterOfferTransition(
  previousStatus: ApplicationStatus | null,
  nextStatus: ApplicationStatus,
  appVersion?: string,
): Promise<boolean> {
  const queuedRequest = reviewQueue.then(() => requestAppReview(previousStatus, nextStatus, appVersion));
  reviewQueue = queuedRequest.catch(() => undefined);
  return queuedRequest;
}
