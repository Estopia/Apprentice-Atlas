import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getOriginalListingUrl, resetJobDetailState, type JobDetailState } from '../src/lib/job-detail-state';

describe('job detail route state', () => {
  it('clears data and errors when the route id changes', () => {
    const previous: JobDetailState = { job: {} as never, explanation: {} as never, loading: false, aiLoading: true, error: 'old job', aiError: 'old AI error' };
    expect(resetJobDetailState(previous)).toEqual({ job: null, explanation: null, loading: true, aiLoading: false, error: null, aiError: null });
  });

  it('normalizes valid listing URLs and safely hides legacy invalid values', () => {
    expect(getOriginalListingUrl({ sourceUrl: ' https://official.example/listing/1 ' })).toBe('https://official.example/listing/1');
    expect(getOriginalListingUrl({ sourceUrl: 'http://official.example/listing/1' })).toBe('http://official.example/listing/1');
    expect(getOriginalListingUrl({ sourceUrl: null })).toBeNull();
    expect(getOriginalListingUrl({ sourceUrl: '' })).toBeNull();
    for (const sourceUrl of ['https://?', 'https://', 'http:///', ' javascript:alert(1) ', 'https://official.example/listing/1 junk']) {
      expect(getOriginalListingUrl({ sourceUrl })).toBeNull();
    }
  });

  it('renders the original-link action only for a safe normalized URL', () => {
    const detailScreen = readFileSync('src/app/job/[id].tsx', 'utf8');
    expect(detailScreen).toContain('const sourceUrl = getOriginalListingUrl(job);');
    expect(detailScreen).toMatch(/sourceUrl\s*&&\s*<Pressable/);
    expect(detailScreen).not.toContain('throw new Error');
  });
});
