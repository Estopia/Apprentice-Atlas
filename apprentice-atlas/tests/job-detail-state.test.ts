import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as jobDetailState from '../src/lib/job-detail-state';
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

  it('uses the safe normalized source as the fallback primary action', () => {
    const detailScreen = readFileSync('src/app/job/[id].tsx', 'utf8');
    expect(detailScreen).toContain('const sourceUrl = getOriginalListingUrl(job);');
    expect(detailScreen).toContain('const primaryUrl = applicationUrl ?? sourceUrl;');
    expect(detailScreen).toMatch(/primaryUrl\s*&&\s*<Pressable/);
    expect(detailScreen).not.toContain('throw new Error');
  });

  it('validates application destinations before preferring the apply action', () => {
    const detailScreen = readFileSync('src/app/job/[id].tsx', 'utf8');
    expect(detailScreen).toContain('const applicationUrl = getValidHttpUrl(job.applicationUrl);');
    expect(detailScreen).toContain("const primaryLabel = applicationUrl ? t(locale, 'actions.apply') : t(locale, 'job.openSourceShort');");
    expect(detailScreen).toContain('Linking.openURL(primaryUrl)');
    expect(detailScreen).not.toContain('Linking.openURL(job.applicationUrl!)');
  });

  it('scopes private detail state to both authenticated user and job', () => {
    const ownershipKey = (jobDetailState as unknown as {
      jobDetailOwnershipKey?: (userId: string | null, jobId: string | null) => string | null;
    }).jobDetailOwnershipKey;
    const isCurrent = (jobDetailState as unknown as {
      isCurrentJobDetailOwnership?: (captured: string | null, current: string | null) => boolean;
    }).isCurrentJobDetailOwnership;

    expect(ownershipKey).toBeTypeOf('function');
    expect(isCurrent).toBeTypeOf('function');
    if (!ownershipKey || !isCurrent) return;

    const firstUser = ownershipKey('user-1', 'job-1');
    expect(firstUser).toBe('user-1:job-1');
    expect(isCurrent(firstUser, ownershipKey('user-2', 'job-1'))).toBe(false);
    expect(isCurrent(firstUser, ownershipKey('user-1', 'job-2'))).toBe(false);
    expect(ownershipKey(null, 'job-1')).toBeNull();
  });

  it('clears and rejects stale private state on account changes before exposing calendar dates', () => {
    const detailScreen = readFileSync('src/app/job/[id].tsx', 'utf8');

    expect(detailScreen).toContain('jobDetailOwnershipKey(authUserId, job?.id ?? null)');
    expect(detailScreen).not.toContain('auth.session.access_token');
    expect(detailScreen).toMatch(/ownership\.identity !== ownershipIdentity[\s\S]+epoch: ownership\.epoch \+ 1/);
    expect(detailScreen).toMatch(/ownership\.identity !== ownershipIdentity[\s\S]+setFavorite\(null\)[\s\S]+setApplication\(null\)[\s\S]+setReminderState\('not-scheduled'\)/);
    expect(detailScreen).toMatch(/isCurrentJobDetailOwnership\(operationKey, currentOwnershipKeyRef\.current\)/);
    expect(detailScreen.match(/isCurrentJobDetailOwnership\(operationKey, currentOwnershipKeyRef\.current\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(detailScreen).toMatch(/const activeApplication =[\s\S]+applicationOwnershipKey === ownershipKey/);
    const calendarBlock = detailScreen.slice(detailScreen.indexOf('const addTrackedDateToCalendar'), detailScreen.indexOf('if (loading)'));
    expect(calendarBlock).toContain('activeApplication?.interviewAt ?? null');
    expect(calendarBlock).not.toContain('application?.interviewAt');
  });
});
