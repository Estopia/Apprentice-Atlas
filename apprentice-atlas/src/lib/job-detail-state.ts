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

export function getOriginalListingUrl(job: Pick<Job, 'sourceUrl'>): string | null {
  return getValidHttpUrl(job.sourceUrl);
}
