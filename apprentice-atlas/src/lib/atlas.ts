import type { ApplicationStatus, TrackedApplication } from '@/types/jobs';

const ACTIVE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'interested',
  'preparing',
  'applied',
  'interview',
]);

export type ApplicationSummary = {
  total: number;
  active: number;
  finished: number;
  interviews: number;
  offers: number;
};

export type ApplicationGroups = {
  active: TrackedApplication[];
  finished: TrackedApplication[];
};

export function safeTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function summarizeApplications(applications: readonly TrackedApplication[]): ApplicationSummary {
  return applications.reduce<ApplicationSummary>((summary, application) => {
    summary.total += 1;
    if (ACTIVE_STATUSES.has(application.status)) summary.active += 1;
    else summary.finished += 1;
    if (application.status === 'interview') summary.interviews += 1;
    if (application.status === 'offer') summary.offers += 1;
    return summary;
  }, { total: 0, active: 0, finished: 0, interviews: 0, offers: 0 });
}

export function groupApplications(applications: readonly TrackedApplication[]): ApplicationGroups {
  const newestFirst = [...applications].sort((left, right) => {
    const leftTimestamp = safeTimestamp(left.updatedAt);
    const rightTimestamp = safeTimestamp(right.updatedAt);
    if (leftTimestamp === null && rightTimestamp !== null) return 1;
    if (leftTimestamp !== null && rightTimestamp === null) return -1;
    if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  });
  return {
    active: newestFirst.filter((application) => ACTIVE_STATUSES.has(application.status)),
    finished: newestFirst.filter((application) => !ACTIVE_STATUSES.has(application.status)),
  };
}
