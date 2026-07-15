import type { TrackedApplication } from '@/types/jobs';

export type AtlasNextActionKind =
  | 'discover'
  | 'start-application'
  | 'continue-application'
  | 'follow-up'
  | 'prepare-interview'
  | 'review-offer';

export type AtlasNextAction = {
  kind: AtlasNextActionKind;
  application: TrackedApplication | null;
};

const actionByStatus = {
  interested: { kind: 'start-application', priority: 1 },
  applied: { kind: 'follow-up', priority: 2 },
  preparing: { kind: 'continue-application', priority: 3 },
  interview: { kind: 'prepare-interview', priority: 4 },
  offer: { kind: 'review-offer', priority: 5 },
} as const;

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function deriveAtlasNextAction(applications: readonly TrackedApplication[]): AtlasNextAction {
  const candidates = applications
    .flatMap((application) => application.status === 'closed'
      ? []
      : [{ application, ...actionByStatus[application.status] }])
    .sort((left, right) => (
      right.priority - left.priority
      || timestamp(right.application.updatedAt) - timestamp(left.application.updatedAt)
      || left.application.id.localeCompare(right.application.id)
    ));

  const next = candidates[0];
  return next
    ? { kind: next.kind, application: next.application }
    : { kind: 'discover', application: null };
}
