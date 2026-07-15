import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeState = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  scheduleNotificationAsync: vi.fn(async () => 'new-notification-id'),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => nativeState.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => { nativeState.storage.set(key, value); },
    removeItem: async (key: string) => { nativeState.storage.delete(key); },
  },
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: nativeState.cancelScheduledNotificationAsync,
  getPermissionsAsync: async () => ({ granted: true }),
  requestPermissionsAsync: async () => ({ granted: true }),
  scheduleNotificationAsync: nativeState.scheduleNotificationAsync,
  setNotificationChannelAsync: async () => undefined,
}));

import { buildCalendarEventPayload } from '../src/lib/calendar-sync';
import {
  getDeadlineReminderDate,
  parseNotificationJobRoute,
  scheduleDeadlineReminder,
} from '../src/lib/deadline-reminders';
import { shouldRequestAppReview } from '../src/lib/review-prompt';

const jobId = '11111111-1111-4111-8111-111111111111';

describe('app review eligibility', () => {
  it('allows the first successful non-offer to offer transition for an app version', () => {
    expect(shouldRequestAppReview('interview', 'offer', '1.2.0', null)).toBe(true);
    expect(shouldRequestAppReview('preparing', 'offer', '1.2.0', '1.1.0')).toBe(true);
  });

  it('rejects repeated, non-transition, and already-prompted review requests', () => {
    expect(shouldRequestAppReview('offer', 'offer', '1.2.0', null)).toBe(false);
    expect(shouldRequestAppReview('interview', 'closed', '1.2.0', null)).toBe(false);
    expect(shouldRequestAppReview(null, 'offer', '1.2.0', null)).toBe(false);
    expect(shouldRequestAppReview('interview', 'offer', '1.2.0', '1.2.0')).toBe(false);
    expect(shouldRequestAppReview('interview', 'offer', '', null)).toBe(false);
  });
});

describe('deadline reminders', () => {
  const now = new Date('2026-07-15T10:00:00.000Z');

  beforeEach(() => {
    nativeState.storage.clear();
    nativeState.cancelScheduledNotificationAsync.mockClear();
    nativeState.scheduleNotificationAsync.mockReset();
    nativeState.scheduleNotificationAsync.mockResolvedValue('new-notification-id');
    vi.stubEnv('EXPO_OS', 'ios');
  });

  it('returns a reminder exactly three days before a future deadline', () => {
    expect(getDeadlineReminderDate('2026-07-22T10:00:00.000Z', null, now)?.toISOString())
      .toBe('2026-07-19T10:00:00.000Z');
    expect(getDeadlineReminderDate('2026-07-22T10:00:00.000Z', 'preparing', now)?.toISOString())
      .toBe('2026-07-19T10:00:00.000Z');
  });

  it('omits missing, invalid, past, already-applied, and no-longer-schedulable reminders', () => {
    expect(getDeadlineReminderDate(null, null, now)).toBeNull();
    expect(getDeadlineReminderDate('not-a-date', null, now)).toBeNull();
    expect(getDeadlineReminderDate('2026-07-14T10:00:00.000Z', null, now)).toBeNull();
    expect(getDeadlineReminderDate('2026-07-22T10:00:00.000Z', 'applied', now)).toBeNull();
    expect(getDeadlineReminderDate('2026-07-22T10:00:00.000Z', 'interview', now)).toBeNull();
    expect(getDeadlineReminderDate('2026-07-17T10:00:00.000Z', null, now)).toBeNull();
  });

  it('removes a canceled identifier when replacement scheduling fails', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';
    const storageKey = `apprentice-atlas:deadline-reminder:${userId}:${jobId}`;
    nativeState.storage.set(storageKey, 'old-notification-id');
    nativeState.scheduleNotificationAsync.mockRejectedValueOnce(new Error('scheduling unavailable'));

    await expect(scheduleDeadlineReminder({
      userId,
      jobId,
      deadlineAt: '2026-07-22T10:00:00.000Z',
      title: 'Deadline soon',
      body: 'Three days remain.',
      now,
    })).resolves.toBeNull();

    expect(nativeState.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-notification-id');
    expect(nativeState.storage.has(storageKey)).toBe(false);
  });
});

describe('notification routes', () => {
  it('accepts only exact job-detail routes with a UUID', () => {
    expect(parseNotificationJobRoute(`/job/${jobId}`)).toBe(`/job/${jobId}`);
    expect(parseNotificationJobRoute('/job/not-a-uuid')).toBeNull();
    expect(parseNotificationJobRoute(`/job/${jobId}/apply`)).toBeNull();
    expect(parseNotificationJobRoute(`/job/${jobId}?from=notification`)).toBeNull();
    expect(parseNotificationJobRoute(`https://evil.test/job/${jobId}`)).toBeNull();
    expect(parseNotificationJobRoute(null)).toBeNull();
  });
});

describe('calendar event payloads', () => {
  const job = {
    id: jobId,
    title: 'Software Developer Apprentice',
    company: 'Example GmbH',
    deadlineAt: '2026-08-01T16:00:00.000Z',
    interviewAt: '2026-07-28T09:30:00.000Z',
    contactEmail: 'invented@example.test',
  };

  it('uses the official listing deadline for deadline events', () => {
    const payload = buildCalendarEventPayload('deadline', job);

    expect(payload).toMatchObject({
      title: 'Software Developer Apprentice · Example GmbH',
      startDate: '2026-08-01T16:00:00.000Z',
    });
    expect(Object.keys(payload ?? {})).not.toContain('contactEmail');
    expect(Object.keys(payload ?? {})).not.toContain('attendees');
    expect(Object.keys(payload ?? {})).not.toContain('organizer');
  });

  it('uses the tracked interview date for interview events and never falls back to another date', () => {
    expect(buildCalendarEventPayload('interview', job)).toMatchObject({
      title: 'Software Developer Apprentice · Example GmbH',
      startDate: '2026-07-28T09:30:00.000Z',
    });
    expect(buildCalendarEventPayload('interview', { ...job, interviewAt: null })).toBeNull();
    expect(buildCalendarEventPayload('deadline', { ...job, deadlineAt: null })).toBeNull();
  });
});
