import type { ApplicationStatus, Job, TrackedApplication } from '@/types/jobs';
import type { DeadlineReminderGeneration } from './deadline-reminders';

export const APPLICATION_STATUSES = [
  'interested',
  'preparing',
  'applied',
  'interview',
  'offer',
  'closed',
] as const satisfies readonly ApplicationStatus[];

const PROGRESSION_STATUSES = [
  'interested',
  'preparing',
  'applied',
  'interview',
  'offer',
] as const satisfies readonly ApplicationStatus[];

export type ApplicationJourneyStep = {
  status: ApplicationStatus;
  state: 'completed' | 'current' | 'upcoming' | 'terminal';
  selected: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function applicationWorkflowKey(userId: string | null, jobId: string): string | null {
  return userId && jobId ? `${userId}:${jobId}` : null;
}

export function isCurrentWorkflowOperation(capturedKey: string | null, currentKey: string | null): boolean {
  return capturedKey !== null && capturedKey === currentKey;
}

export function deriveApplicationJourney(status: ApplicationStatus): ApplicationJourneyStep[] {
  const selectedProgressIndex = status === 'closed' ? -1 : PROGRESSION_STATUSES.indexOf(status);
  return [
    ...PROGRESSION_STATUSES.map((candidate, index): ApplicationJourneyStep => ({
      status: candidate,
      state: selectedProgressIndex < 0 ? 'upcoming' : index < selectedProgressIndex ? 'completed' : index === selectedProgressIndex ? 'current' : 'upcoming',
      selected: candidate === status,
    })),
    { status: 'closed', state: 'terminal', selected: status === 'closed' },
  ];
}

export function applicationNoteLength(note: string): number {
  return Array.from(note).length;
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function isApplicationDraftValid(status: unknown, note: unknown): boolean {
  return isApplicationStatus(status)
    && typeof note === 'string'
    && applicationNoteLength(note) <= 500;
}

export function isValidApplicationJobId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function normalizeInterviewDateSelection(value: Date, now = new Date()): string | null {
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) && timestamp > now.getTime()
    ? new Date(timestamp).toISOString()
    : null;
}

export type ApplicationSheetLoadResolution =
  | { kind: 'ready'; job: Job | null; application: TrackedApplication | null }
  | { kind: 'redirect' }
  | { kind: 'error'; reason: 'application' | 'job-load' | 'job-unavailable' };

export function resolveApplicationSheetLoad(
  jobResult: { data: Job | null; error: unknown | null },
  applicationResult: { data: TrackedApplication | null; error: { code: string } | null },
): ApplicationSheetLoadResolution {
  if (applicationResult.error?.code === 'auth-required') return { kind: 'redirect' };
  if (applicationResult.error) return { kind: 'error', reason: 'application' };
  if (jobResult.data || applicationResult.data) {
    return { kind: 'ready', job: jobResult.data, application: applicationResult.data };
  }
  return { kind: 'error', reason: jobResult.error ? 'job-load' : 'job-unavailable' };
}

export function confirmApplicationRemovalOnWeb(
  confirm: ((message: string) => boolean) | undefined,
  title: string,
  body: string,
  onConfirm: () => unknown,
): boolean {
  if (!confirm?.(`${title}\n\n${body}`)) return false;
  onConfirm();
  return true;
}

type ApplicationRemovalFavoriteResult = {
  data: unknown | null;
  error: unknown | null;
};

type ApplicationRemovalReminderInput = {
  userId: string;
  jobId: string;
  deadlineAt: string | null;
  title: string;
  body: string;
  generation?: DeadlineReminderGeneration | null;
  getFavorite: (jobId: string) => Promise<ApplicationRemovalFavoriteResult>;
  reconcile: (input: {
    userId: string;
    jobId: string;
    deadlineAt: string | null;
    applicationStatus: null;
    saved: boolean;
    title: string;
    body: string;
    generation?: DeadlineReminderGeneration | null;
  }) => Promise<unknown>;
};

export async function reconcileApplicationRemovalReminder(
  input: ApplicationRemovalReminderInput,
): Promise<void> {
  let saved = false;
  try {
    const favorite = await input.getFavorite(input.jobId);
    saved = favorite.error === null && favorite.data !== null;
  } catch {
    // Unknown favorite state falls back to cancellation to avoid an orphaned reminder.
  }

  try {
    await input.reconcile({
      userId: input.userId,
      jobId: input.jobId,
      deadlineAt: input.deadlineAt,
      applicationStatus: null,
      saved,
      ...(input.generation ? { generation: input.generation } : {}),
      title: input.title,
      body: input.body,
    });
  } catch {
    // Native reminder reconciliation is best effort and never changes persistence.
  }
}

export function validatedPendingTrackJobId(params: {
  pendingAction?: unknown;
  jobId?: unknown;
  returnTo?: unknown;
}): string | null {
  const { jobId, pendingAction, returnTo } = params;
  if (pendingAction !== 'track' || !isValidApplicationJobId(jobId)) return null;
  return returnTo === `/job/${jobId}` ? jobId : null;
}
