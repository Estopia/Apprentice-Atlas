import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeState = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  scheduleNotificationAsync: vi.fn(async () => 'new-notification-id'),
  getNotificationPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  requestNotificationPermissionsAsync: vi.fn(async () => ({ granted: true, status: 'granted', canAskAgain: true })),
  requestCalendarPermissions: vi.fn(async () => ({ granted: true })),
  createEventInCalendarAsync: vi.fn(async () => ({ action: 'saved', id: 'event-id' })),
  platformVersion: 17 as string | number,
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
  getPermissionsAsync: nativeState.getNotificationPermissionsAsync,
  requestPermissionsAsync: nativeState.requestNotificationPermissionsAsync,
  scheduleNotificationAsync: nativeState.scheduleNotificationAsync,
  setNotificationChannelAsync: async () => undefined,
}));

vi.mock('expo-calendar', () => ({
  requestCalendarPermissions: nativeState.requestCalendarPermissions,
}));

vi.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: nativeState.createEventInCalendarAsync,
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    get Version() { return nativeState.platformVersion; },
  },
}));

import { buildCalendarEventPayload, openCalendarEventForm } from '../src/lib/calendar-sync';
import {
  cancelDeadlineReminder,
  getDeadlineReminderDate,
  parseNotificationJobRoute,
  scheduleDeadlineReminder,
} from '../src/lib/deadline-reminders';
import * as deadlineReminders from '../src/lib/deadline-reminders';
import { shouldRequestAppReview } from '../src/lib/review-prompt';

const jobId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const reminderStorageKey = `apprentice-atlas:deadline-reminder:${userId}:${jobId}`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function reminderInput(title: string) {
  return {
    userId,
    jobId,
    deadlineAt: '2026-07-22T10:00:00.000Z',
    title,
    body: 'Three days remain.',
    now: new Date('2026-07-15T10:00:00.000Z'),
  };
}

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
    nativeState.getNotificationPermissionsAsync.mockReset();
    nativeState.getNotificationPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
    nativeState.requestNotificationPermissionsAsync.mockReset();
    nativeState.requestNotificationPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
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
    nativeState.storage.set(reminderStorageKey, 'old-notification-id');
    nativeState.scheduleNotificationAsync.mockRejectedValueOnce(new Error('scheduling unavailable'));

    await expect(scheduleDeadlineReminder(reminderInput('Deadline soon'))).resolves.toBeNull();

    expect(nativeState.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-notification-id');
    expect(nativeState.storage.has(reminderStorageKey)).toBe(false);
  });

  it('reports permission denial distinctly from unavailable native scheduling', async () => {
    const scheduleWithState = (deadlineReminders as unknown as {
      scheduleDeadlineReminderWithState?: (input: ReturnType<typeof reminderInput>) => Promise<{ state: string; notificationId: string | null }>;
    }).scheduleDeadlineReminderWithState;
    expect(scheduleWithState).toBeTypeOf('function');
    if (!scheduleWithState) return;

    nativeState.getNotificationPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true });
    nativeState.requestNotificationPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false });

    await expect(scheduleWithState(reminderInput('Deadline soon'))).resolves.toEqual({
      state: 'permission-denied',
      notificationId: null,
    });
    expect(nativeState.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('serializes two schedules so the first notification cannot be orphaned', async () => {
    const firstNativeSchedule = deferred<string>();
    nativeState.scheduleNotificationAsync
      .mockImplementationOnce(() => firstNativeSchedule.promise)
      .mockResolvedValueOnce('notification-2');

    const firstSchedule = scheduleDeadlineReminder(reminderInput('First deadline'));
    await vi.waitFor(() => expect(nativeState.scheduleNotificationAsync).toHaveBeenCalledTimes(1));

    const secondSchedule = scheduleDeadlineReminder(reminderInput('Updated deadline'));
    await nextTick();
    expect(nativeState.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    firstNativeSchedule.resolve('notification-1');
    await expect(firstSchedule).resolves.toBe('notification-1');
    await expect(secondSchedule).resolves.toBe('notification-2');

    expect(nativeState.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-1');
    expect(nativeState.storage.get(reminderStorageKey)).toBe('notification-2');
  });

  it('serializes cancellation behind an in-flight schedule', async () => {
    const nativeSchedule = deferred<string>();
    nativeState.scheduleNotificationAsync.mockImplementationOnce(() => nativeSchedule.promise);

    const schedule = scheduleDeadlineReminder(reminderInput('Deadline soon'));
    await vi.waitFor(() => expect(nativeState.scheduleNotificationAsync).toHaveBeenCalledTimes(1));

    let cancelSettled = false;
    const cancel = cancelDeadlineReminder(userId, jobId).finally(() => { cancelSettled = true; });
    await nextTick();
    expect(cancelSettled).toBe(false);

    nativeSchedule.resolve('notification-1');
    await expect(schedule).resolves.toBe('notification-1');
    await expect(cancel).resolves.toBe(true);

    expect(nativeState.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-1');
    expect(nativeState.storage.has(reminderStorageKey)).toBe(false);
  });

  it('discards a delayed saved-state lookup after a later unsave succeeds', async () => {
    const begin = (deadlineReminders as unknown as {
      beginDeadlineReminderReconciliation?: (userId: string, jobId: string) => unknown;
    }).beginDeadlineReminderReconciliation;
    expect(begin).toBeTypeOf('function');
    if (!begin) return;

    const lookup = deferred<void>();
    const schedule = vi.fn(async () => ({ state: 'scheduled', notificationId: 'stale' }));
    const cancel = vi.fn(async () => true);
    const staleGeneration = begin(userId, jobId);
    const staleSave = lookup.promise.then(() => deadlineReminders.reconcileDeadlineReminder({
      ...reminderInput('Delayed save'),
      saved: true,
      generation: staleGeneration,
      schedule,
      cancel,
    } as never));

    const unsaveGeneration = begin(userId, jobId);
    await deadlineReminders.reconcileDeadlineReminder({
      ...reminderInput('Unsave'),
      saved: false,
      generation: unsaveGeneration,
      schedule,
      cancel,
    } as never);
    lookup.resolve();
    await staleSave;

    expect(cancel).toHaveBeenCalledOnce();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('discards a delayed saved-state lookup after a later applied status succeeds', async () => {
    const begin = (deadlineReminders as unknown as {
      beginDeadlineReminderReconciliation?: (userId: string, jobId: string) => unknown;
    }).beginDeadlineReminderReconciliation;
    expect(begin).toBeTypeOf('function');
    if (!begin) return;

    const lookup = deferred<void>();
    const schedule = vi.fn(async () => ({ state: 'scheduled', notificationId: 'stale' }));
    const cancel = vi.fn(async () => true);
    const staleGeneration = begin(userId, jobId);
    const staleSave = lookup.promise.then(() => deadlineReminders.reconcileDeadlineReminder({
      ...reminderInput('Delayed save'),
      saved: true,
      generation: staleGeneration,
      schedule,
      cancel,
    } as never));

    const appliedGeneration = begin(userId, jobId);
    await deadlineReminders.reconcileDeadlineReminder({
      ...reminderInput('Applied'),
      applicationStatus: 'applied',
      saved: true,
      generation: appliedGeneration,
      schedule,
      cancel,
    } as never);
    lookup.resolve();
    await staleSave;

    expect(cancel).toHaveBeenCalledOnce();
    expect(schedule).not.toHaveBeenCalled();
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

  beforeEach(() => {
    vi.stubEnv('EXPO_OS', 'ios');
    nativeState.requestCalendarPermissions.mockClear();
    nativeState.createEventInCalendarAsync.mockClear();
  });

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

  it('requests legacy calendar authorization on iOS 16 before opening the form', async () => {
    nativeState.platformVersion = '16.7';
    const payload = buildCalendarEventPayload('deadline', job)!;

    await expect(openCalendarEventForm(payload)).resolves.toBe(true);

    expect(nativeState.requestCalendarPermissions).toHaveBeenCalledWith(false);
    expect(nativeState.createEventInCalendarAsync).toHaveBeenCalledWith(payload);
  });

  it('requests write-only calendar authorization on iOS 17 and newer', async () => {
    nativeState.platformVersion = 17;
    const payload = buildCalendarEventPayload('interview', job)!;

    await expect(openCalendarEventForm(payload)).resolves.toBe(true);

    expect(nativeState.requestCalendarPermissions).toHaveBeenCalledWith(true);
    expect(nativeState.createEventInCalendarAsync).toHaveBeenCalledWith(payload);
  });

  it('does not dynamically enumerate every React Native export on iOS', () => {
    const source = readFileSync('src/lib/calendar-sync.ts', 'utf8');

    expect(source).toContain("import { Platform } from 'react-native';");
    expect(source).not.toContain("import('react-native')");
  });
});

describe('calendar native configuration', () => {
  it('supports legacy iOS authorization and blocks all Android calendar permissions', () => {
    const config = JSON.parse(readFileSync('app.json', 'utf8')).expo;
    const calendarPlugin = config.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-calendar',
    );

    expect(calendarPlugin?.[1]).toMatchObject({
      calendarPermission: expect.stringContaining('application deadlines and interview dates'),
      writeOnlyCalendarPermission: expect.stringContaining('application deadlines and interview dates'),
      writeOnlyAccess: true,
    });
    expect(config.android.blockedPermissions).toEqual(expect.arrayContaining([
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
    ]));
  });
});
