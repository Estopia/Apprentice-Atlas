import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  APPLICATION_STATUSES,
  applicationNoteLength,
  isApplicationDraftValid,
  validatedPendingTrackJobId,
} from '../src/lib/application-flow';

const jobId = '11111111-1111-4111-8111-111111111111';

describe('application form helpers', () => {
  it('exposes all six supported journey statuses', () => {
    expect(APPLICATION_STATUSES).toEqual([
      'interested',
      'preparing',
      'applied',
      'interview',
      'offer',
      'closed',
    ]);
  });

  it('counts Unicode code points and accepts at most 500', () => {
    expect(applicationNoteLength('😀'.repeat(500))).toBe(500);
    expect(isApplicationDraftValid('applied', '😀'.repeat(500))).toBe(true);
    expect(applicationNoteLength('😀'.repeat(501))).toBe(501);
    expect(isApplicationDraftValid('applied', '😀'.repeat(501))).toBe(false);

    const fiveHundredCombiningCodePoints = 'e\u0301'.repeat(250);
    expect(applicationNoteLength(fiveHundredCombiningCodePoints)).toBe(500);
    expect(isApplicationDraftValid('interview', fiveHundredCombiningCodePoints)).toBe(true);
    expect(isApplicationDraftValid('interview', `${fiveHundredCombiningCodePoints}x`)).toBe(false);
  });

  it('rejects unsupported statuses', () => {
    expect(isApplicationDraftValid('pending', '')).toBe(false);
  });
});

describe('pending application tracking', () => {
  it('accepts only a matching track action, UUID, and job detail return path', () => {
    expect(validatedPendingTrackJobId({ pendingAction: 'track', jobId, returnTo: `/job/${jobId}` })).toBe(jobId);
    expect(validatedPendingTrackJobId({ pendingAction: 'save', jobId, returnTo: `/job/${jobId}` })).toBeNull();
    expect(validatedPendingTrackJobId({ pendingAction: 'track', jobId: 'not-a-uuid', returnTo: '/job/not-a-uuid' })).toBeNull();
    expect(validatedPendingTrackJobId({ pendingAction: 'track', jobId, returnTo: '/atlas' })).toBeNull();
    expect(validatedPendingTrackJobId({ pendingAction: 'track', jobId, returnTo: `/job/${jobId}?next=https://evil.test` })).toBeNull();
  });
});

describe('application journey route integration', () => {
  it('registers a native form sheet and implements the editable journey form', () => {
    const layout = readFileSync('src/app/_layout.tsx', 'utf8');
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');

    expect(layout).toMatch(/name="application\/\[jobId\]"/);
    expect(layout).toMatch(/presentation: 'formSheet'/);
    expect(layout).toMatch(/sheetGrabberVisible: true/);
    expect(layout).toMatch(/sheetAllowedDetents:/);
    expect(sheet).toMatch(/return \(\s*<ScrollView/);
    expect(sheet).toMatch(/contentInsetAdjustmentBehavior="automatic"/);
    expect(sheet).toMatch(/APPLICATION_STATUSES\.map/);
    expect(sheet).toMatch(/minHeight: 44/);
    expect(sheet).toMatch(/getApplicationForJob/);
    expect(sheet).toMatch(/upsertApplication/);
    expect(sheet).toMatch(/removeApplication/);
    expect(sheet).not.toMatch(/maxLength=/);
  });

  it('refreshes detail tracking on focus and limits auth continuation to the validated track action', () => {
    const detail = readFileSync('src/app/job/[id].tsx', 'utf8');
    const auth = readFileSync('src/app/auth.tsx', 'utf8');
    const messages = readFileSync('src/lib/i18n.ts', 'utf8');

    expect(detail).toMatch(/useFocusEffect/);
    expect(detail).toMatch(/getApplicationForJob/);
    expect(detail).toMatch(/pendingAction: 'track'/);
    expect(detail).toMatch(/pathname: '\/application\/\[jobId\]'/);
    expect(auth).toMatch(/validatedPendingTrackJobId/);
    expect(auth).toMatch(/pathname: '\/application\/\[jobId\]'/);
    expect(messages.match(/'application\.journey':/g)).toHaveLength(2);
  });
});
