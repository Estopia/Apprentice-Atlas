import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  APPLICATION_STATUSES,
  applicationWorkflowKey,
  applicationNoteLength,
  confirmApplicationRemovalOnWeb,
  deriveApplicationJourney,
  isCurrentWorkflowOperation,
  isApplicationDraftValid,
  resolveApplicationSheetLoad,
  validatedPendingTrackJobId,
} from '../src/lib/application-flow';

const jobId = '11111111-1111-4111-8111-111111111111';

describe('application form helpers', () => {
  it('keys workflow state by user and route and rejects stale completions', () => {
    const first = applicationWorkflowKey('user-1', jobId);
    const otherJob = applicationWorkflowKey('user-1', '22222222-2222-4222-8222-222222222222');
    const otherUser = applicationWorkflowKey('user-2', jobId);

    expect(first).toBe('user-1:11111111-1111-4111-8111-111111111111');
    expect(applicationWorkflowKey(null, jobId)).toBeNull();
    expect(isCurrentWorkflowOperation(first, first)).toBe(true);
    expect(isCurrentWorkflowOperation(first, otherJob)).toBe(false);
    expect(isCurrentWorkflowOperation(first, otherUser)).toBe(false);
    expect(isCurrentWorkflowOperation(null, first)).toBe(false);
  });

  it('treats closed as a terminal branch without completing interview or offer', () => {
    expect(deriveApplicationJourney('interview')).toEqual([
      { status: 'interested', state: 'completed', selected: false },
      { status: 'preparing', state: 'completed', selected: false },
      { status: 'applied', state: 'completed', selected: false },
      { status: 'interview', state: 'current', selected: true },
      { status: 'offer', state: 'upcoming', selected: false },
      { status: 'closed', state: 'terminal', selected: false },
    ]);
    expect(deriveApplicationJourney('closed')).toEqual([
      { status: 'interested', state: 'upcoming', selected: false },
      { status: 'preparing', state: 'upcoming', selected: false },
      { status: 'applied', state: 'upcoming', selected: false },
      { status: 'interview', state: 'upcoming', selected: false },
      { status: 'offer', state: 'upcoming', selected: false },
      { status: 'closed', state: 'terminal', selected: true },
    ]);
  });

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

  it('keeps an existing application editable when its public job is unavailable', () => {
    const existingApplication = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      jobId,
      status: 'interview' as const,
      note: 'Keep this private note',
      createdAt: '2026-07-14T10:00:00.000Z',
      updatedAt: '2026-07-14T11:00:00.000Z',
    };

    expect(resolveApplicationSheetLoad(
      { data: null, error: { code: 'query' } },
      { data: existingApplication, error: null },
    )).toEqual({ kind: 'ready', job: null, application: existingApplication });
    expect(resolveApplicationSheetLoad(
      { data: null, error: null },
      { data: null, error: null },
    )).toEqual({ kind: 'error', reason: 'job-unavailable' });
  });

  it('requires web confirmation and leaves removal untouched when cancelled', () => {
    const remove = vi.fn();
    const cancel = vi.fn(() => false);

    expect(confirmApplicationRemovalOnWeb(cancel, 'Remove application?', 'This cannot be undone.', remove)).toBe(false);
    expect(cancel).toHaveBeenCalledWith('Remove application?\n\nThis cannot be undone.');
    expect(remove).not.toHaveBeenCalled();

    const accept = vi.fn(() => true);
    expect(confirmApplicationRemovalOnWeb(accept, 'Remove application?', 'This cannot be undone.', remove)).toBe(true);
    expect(remove).toHaveBeenCalledOnce();
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
  it('integrates the user-and-route workflow scope without keying drafts to token refreshes', () => {
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');

    expect(sheet).toContain('applicationWorkflowKey(authUserId, routeJobId)');
    expect(sheet).toContain('loadedWorkflowKey === workflowKey');
    expect(sheet).toContain('currentWorkflowKeyRef.current = workflowKey');
    expect(sheet).not.toContain('applicationWorkflowKey(authUserId, auth.session?.access_token');
  });

  it('guards load, save, and remove completions after the sheet unmounts', () => {
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');
    const saveBlock = sheet.slice(sheet.indexOf('const save = async'), sheet.indexOf('const remove = async'));
    const removeBlock = sheet.slice(sheet.indexOf('const remove = async'), sheet.indexOf('const confirmRemove'));

    expect(sheet).toContain('!active || !mountedRef.current || !isCurrentWorkflowOperation(operationKey, currentWorkflowKeyRef.current)');
    expect(saveBlock).toContain('!mountedRef.current || !isCurrentWorkflowOperation(operationKey, currentWorkflowKeyRef.current)');
    expect(removeBlock).toContain('!mountedRef.current || !isCurrentWorkflowOperation(operationKey, currentWorkflowKeyRef.current)');
    expect(saveBlock).toContain('router.back()');
    expect(removeBlock).toContain('router.back()');
  });

  it('registers a native form sheet and implements the editable journey form', () => {
    const layout = readFileSync('src/app/_layout.tsx', 'utf8');
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');

    expect(layout).toMatch(/name="application\/\[jobId\]"/);
    expect(layout).toMatch(/presentation: 'formSheet'/);
    expect(layout).toMatch(/sheetGrabberVisible: true/);
    expect(layout).toMatch(/sheetAllowedDetents:/);
    expect(sheet).toMatch(/return \(\s*<ScrollView/);
    expect(sheet).toMatch(/contentInsetAdjustmentBehavior="automatic"/);
    expect(sheet).toMatch(/deriveApplicationJourney\(status\)\.map/);
    expect(sheet).toMatch(/minHeight: 44/);
    expect(sheet).toMatch(/getApplicationForJob/);
    expect(sheet).toMatch(/upsertApplication/);
    expect(sheet).toMatch(/removeApplication/);
    expect(sheet).not.toMatch(/maxLength=/);
  });

  it('renders a localized unavailable-listing context for an existing private application', () => {
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');
    const messages = readFileSync('src/lib/i18n.ts', 'utf8');

    expect(sheet).toMatch(/resolveApplicationSheetLoad/);
    expect(sheet).toMatch(/application\.listingUnavailableTitle/);
    expect(sheet).toMatch(/application\.listingUnavailableBody/);
    expect(messages.match(/'application\.listingUnavailableTitle':/g)).toHaveLength(2);
    expect(messages.match(/'application\.listingUnavailableBody':/g)).toHaveLength(2);
  });

  it('uses confirmation on web and the native alert elsewhere', () => {
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');
    const webBlock = sheet.slice(sheet.indexOf("process.env.EXPO_OS === 'web'"), sheet.indexOf('Alert.alert'));

    expect(webBlock).toMatch(/confirmApplicationRemovalOnWeb/);
    expect(webBlock).not.toMatch(/void remove\(\)/);
    expect(sheet).toMatch(/Alert\.alert/);
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
