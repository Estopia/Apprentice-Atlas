import { Platform } from 'react-native';

export type CalendarEventKind = 'deadline' | 'interview';

export interface CalendarJobDates {
  title: string;
  company: string;
  deadlineAt: string | null;
  interviewAt: string | null;
}

export interface CalendarEventPayload {
  title: string;
  startDate: string;
  endDate: string;
  allDay: false;
}

function supportsWriteOnlyCalendarAccess(version: string | number): boolean {
  const majorVersion = Number.parseInt(String(version).split('.')[0], 10);
  return Number.isFinite(majorVersion) && majorVersion >= 17;
}

export function buildCalendarEventPayload(
  kind: CalendarEventKind,
  job: CalendarJobDates,
): CalendarEventPayload | null {
  const selectedDate = kind === 'deadline' ? job.deadlineAt : job.interviewAt;
  if (!selectedDate) return null;

  const startTime = Date.parse(selectedDate);
  if (!Number.isFinite(startTime)) return null;

  return {
    title: `${job.title.trim()} · ${job.company.trim()}`,
    startDate: new Date(startTime).toISOString(),
    endDate: new Date(startTime + 60 * 60 * 1000).toISOString(),
    allDay: false,
  };
}

export async function openCalendarEventForm(payload: CalendarEventPayload): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return false;

  try {
    const Calendar = await import('expo-calendar');
    if (Platform.OS === 'ios') {
      const permission = await Calendar.requestCalendarPermissions(
        supportsWriteOnlyCalendarAccess(Platform.Version),
      );
      if (!permission.granted) return false;
    }

    // The system form is the only cross-platform add-only path; it does not enumerate calendars.
    const LegacyCalendar = await import('expo-calendar/legacy');
    await LegacyCalendar.createEventInCalendarAsync(payload);
    return true;
  } catch {
    return false;
  }
}
