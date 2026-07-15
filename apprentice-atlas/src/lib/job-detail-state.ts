import type { Job, JobExplanation } from '@/types/jobs';
import { getValidHttpUrl } from './official-listing-url';

export type JobDetailState = {
  job: Job | null;
  explanation: JobExplanation | null;
  loading: boolean;
  aiLoading: boolean;
  error: string | null;
  aiError: string | null;
};

export function resetJobDetailState(state: JobDetailState): JobDetailState {
  return { ...state, job: null, explanation: null, loading: true, aiLoading: false, error: null, aiError: null };
}

export function jobDetailOwnershipKey(userId: string | null, jobId: string | null): string | null {
  return userId && jobId ? `${userId}:${jobId}` : null;
}

export function isCurrentJobDetailOwnership(capturedKey: string | null, currentKey: string | null): boolean {
  return capturedKey !== null && capturedKey === currentKey;
}

export function getOriginalListingUrl(job: Pick<Job, 'sourceUrl'>): string | null {
  return getValidHttpUrl(job.sourceUrl);
}
