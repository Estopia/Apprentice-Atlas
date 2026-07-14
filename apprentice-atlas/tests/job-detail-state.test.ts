import { describe, expect, it } from 'vitest';
import { getOriginalListingUrl, resetJobDetailState, type JobDetailState } from '../src/lib/job-detail-state';

describe('job detail route state', () => {
  it('clears data and errors when the route id changes', () => {
    const previous: JobDetailState = { job: {} as never, explanation: {} as never, loading: false, aiLoading: true, error: 'old job', aiError: 'old AI error' };
    expect(resetJobDetailState(previous)).toEqual({ job: null, explanation: null, loading: true, aiLoading: false, error: null, aiError: null });
  });

  it('requires an original official listing URL for detail views', () => {
    expect(getOriginalListingUrl({ sourceUrl: ' https://official.example/listing/1 ' })).toBe('https://official.example/listing/1');
    expect(() => getOriginalListingUrl({ sourceUrl: null })).toThrow('official original-listing URL');
    expect(() => getOriginalListingUrl({ sourceUrl: '' })).toThrow('official original-listing URL');
  });
});
