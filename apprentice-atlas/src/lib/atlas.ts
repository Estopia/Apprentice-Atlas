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
  const newestFirst = [...applications].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  return {
    active: newestFirst.filter((application) => ACTIVE_STATUSES.has(application.status)),
    finished: newestFirst.filter((application) => !ACTIVE_STATUSES.has(application.status)),
  };
}
