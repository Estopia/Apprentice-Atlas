import { describe, expect, it } from 'vitest';
import { resetJobDetailState, type JobDetailState } from '../src/lib/job-detail-state';

describe('job detail route state', () => {
  it('clears data and errors when the route id changes', () => {
    const previous: JobDetailState = { job: {} as never, explanation: {} as never, loading: false, aiLoading: true, error: 'old job', aiError: 'old AI error' };
    expect(resetJobDetailState(previous)).toEqual({ job: null, explanation: null, loading: true, aiLoading: false, error: null, aiError: null });
  });
});
