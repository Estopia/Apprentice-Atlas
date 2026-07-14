import type { ApplicationStatus } from '@/types/jobs';

export const APPLICATION_STATUSES = [
  'interested',
  'preparing',
  'applied',
  'interview',
  'offer',
  'closed',
] as const satisfies readonly ApplicationStatus[];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function validatedPendingTrackJobId(params: {
  pendingAction?: unknown;
  jobId?: unknown;
  returnTo?: unknown;
}): string | null {
  const { jobId, pendingAction, returnTo } = params;
  if (pendingAction !== 'track' || !isValidApplicationJobId(jobId)) return null;
  return returnTo === `/job/${jobId}` ? jobId : null;
}
