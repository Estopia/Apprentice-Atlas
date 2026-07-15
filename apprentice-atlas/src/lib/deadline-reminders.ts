import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ApplicationStatus } from '@/types/jobs';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REMINDER_STORAGE_PREFIX = 'apprentice-atlas:deadline-reminder';
const DEADLINE_CHANNEL_ID = 'application-deadlines';
const APPLIED_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'applied',
  'interview',
  'offer',
  'closed',
]);
const reminderOperationQueues = new Map<string, Promise<void>>();

export type NotificationJobRoute = `/job/${string}`;

export interface ScheduleDeadlineReminderInput {
  userId: string;
  jobId: string;
  deadlineAt: string | null;
  applicationStatus?: ApplicationStatus | null;
  title: string;
  body: string;
  now?: Date;
}

export type DeadlineReminderState = 'scheduled' | 'permission-denied' | 'unavailable' | 'not-scheduled';

export interface DeadlineReminderResult {
  state: DeadlineReminderState;
  notificationId: string | null;
}

export interface ReconcileDeadlineReminderInput extends ScheduleDeadlineReminderInput {
  saved: boolean;
  schedule?: (input: ScheduleDeadlineReminderInput) => Promise<DeadlineReminderResult>;
  cancel?: (userId: string, jobId: string) => Promise<boolean>;
}

export function getDeadlineReminderDate(
  deadlineAt: string | null | undefined,
  applicationStatus: ApplicationStatus | null | undefined,
  now = new Date(),
): Date | null {
  if (!deadlineAt || (applicationStatus && APPLIED_STATUSES.has(applicationStatus))) return null;

  const deadlineTime = Date.parse(deadlineAt);
  if (!Number.isFinite(deadlineTime) || deadlineTime <= now.getTime()) return null;

  const reminder = new Date(deadlineTime - THREE_DAYS_MS);
  return reminder.getTime() > now.getTime() ? reminder : null;
}

export function parseNotificationJobRoute(value: unknown): NotificationJobRoute | null {
  if (typeof value !== 'string') return null;
  const match = /^\/job\/([^/]+)$/.exec(value);
  return match && UUID_PATTERN.test(match[1]) ? value as NotificationJobRoute : null;
}

function reminderStorageKey(userId: string, jobId: string): string | null {
  if (!UUID_PATTERN.test(userId) || !UUID_PATTERN.test(jobId)) return null;
  return `${REMINDER_STORAGE_PREFIX}:${userId}:${jobId}`;
}

function serializeReminderOperation<T>(storageKey: string, operation: () => Promise<T>): Promise<T> {
  const previous = reminderOperationQueues.get(storageKey) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(() => undefined, () => undefined);

  reminderOperationQueues.set(storageKey, tail);
  void tail.then(() => {
    if (reminderOperationQueues.get(storageKey) === tail) {
      reminderOperationQueues.delete(storageKey);
    }
  });

  return result;
}

async function loadNotifications() {
  if (process.env.EXPO_OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function cancelDeadlineReminder(userId: string, jobId: string): Promise<boolean> {
  const storageKey = reminderStorageKey(userId, jobId);
  if (!storageKey) return false;

  return serializeReminderOperation(storageKey, async () => {
    const notificationId = await AsyncStorage.getItem(storageKey);
    if (!notificationId) return false;

    const Notifications = await loadNotifications();
    if (!Notifications) return false;

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(storageKey);
      return true;
    } catch {
      return false;
    }
  });
}

export async function scheduleDeadlineReminder(
  input: ScheduleDeadlineReminderInput,
): Promise<string | null> {
  const result = await scheduleDeadlineReminderWithState(input);
  return result.notificationId;
}

export async function scheduleDeadlineReminderWithState(
  input: ScheduleDeadlineReminderInput,
): Promise<DeadlineReminderResult> {
  const storageKey = reminderStorageKey(input.userId, input.jobId);
  const reminderDate = getDeadlineReminderDate(
    input.deadlineAt,
    input.applicationStatus,
    input.now,
  );
  const route = parseNotificationJobRoute(`/job/${input.jobId}`);
  if (!storageKey || !reminderDate || !route) {
    return { state: 'unavailable', notificationId: null };
  }

  return serializeReminderOperation(storageKey, async () => {
    const Notifications = await loadNotifications();
    if (!Notifications) return { state: 'unavailable', notificationId: null };

    try {
      if (process.env.EXPO_OS === 'android') {
        await Notifications.setNotificationChannelAsync(DEADLINE_CHANNEL_ID, {
          name: 'Application deadlines',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return { state: 'permission-denied', notificationId: null };

      const previousId = await AsyncStorage.getItem(storageKey);
      if (previousId) {
        await Notifications.cancelScheduledNotificationAsync(previousId);
        await AsyncStorage.removeItem(storageKey);
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: input.title,
          body: input.body,
          data: { route },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          ...(process.env.EXPO_OS === 'android' ? { channelId: DEADLINE_CHANNEL_ID } : {}),
        },
      });

      try {
        await AsyncStorage.setItem(storageKey, notificationId);
      } catch (error) {
        await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
        throw error;
      }

      return { state: 'scheduled', notificationId };
    } catch {
      return { state: 'unavailable', notificationId: null };
    }
  });
}

export async function getDeadlineReminderState(userId: string, jobId: string): Promise<DeadlineReminderState> {
  const storageKey = reminderStorageKey(userId, jobId);
  if (!storageKey) return 'unavailable';

  const Notifications = await loadNotifications();
  if (!Notifications) return 'unavailable';

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.status === 'denied') return 'permission-denied';
    return await AsyncStorage.getItem(storageKey) ? 'scheduled' : 'not-scheduled';
  } catch {
    return 'unavailable';
  }
}

export async function reconcileDeadlineReminder(
  input: ReconcileDeadlineReminderInput,
): Promise<DeadlineReminderResult> {
  const schedule = input.schedule ?? scheduleDeadlineReminderWithState;
  const cancel = input.cancel ?? cancelDeadlineReminder;
  const shouldSchedule = input.saved && getDeadlineReminderDate(
    input.deadlineAt,
    input.applicationStatus,
    input.now,
  ) !== null;

  if (!shouldSchedule) {
    await cancel(input.userId, input.jobId).catch(() => false);
    return { state: 'not-scheduled', notificationId: null };
  }

  try {
    return await schedule(input);
  } catch {
    return { state: 'unavailable', notificationId: null };
  }
}

type NotificationRouteHandler = (route: NotificationJobRoute) => void;

export async function registerLocalNotificationHandling(
  onRoute: NotificationRouteHandler,
): Promise<() => void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return () => undefined;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  const handleResponse = (response: import('expo-notifications').NotificationResponse) => {
    const route = parseNotificationJobRoute(response.notification.request.content.data?.route);
    if (route) onRoute(route);
  };

  try {
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleResponse(lastResponse);
      Notifications.clearLastNotificationResponse();
    }
  } catch {
    // A listener still handles future responses when the initial response API is unavailable.
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  return () => subscription.remove();
}
