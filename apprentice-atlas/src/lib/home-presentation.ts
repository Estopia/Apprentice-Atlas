import type { ApplicationStatus, FavoriteJob, Job, TrackedApplication } from '../types/jobs';

const EARTH_RADIUS_KM = 6371;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECOMMENDATIONS = 6;
const MIN_RECOMMENDATIONS_WITH_FALLBACK = 4;
const MAX_UPCOMING_DEADLINES = 3;
const DEADLINE_WINDOW_MS = 14 * DAY_MS;

const DEADLINE_EXCLUDED_STATUSES = new Set<ApplicationStatus>([
  'applied',
  'interview',
  'offer',
  'closed',
]);

export type HomeCoordinates = {
  latitude: number;
  longitude: number;
};

export type HomeJobScoreContext = {
  interestCategories?: readonly string[];
  coordinates?: HomeCoordinates | null;
  now?: Date;
};

export type RankHomeJobsInput = HomeJobScoreContext & {
  jobs: readonly Job[];
  country: string;
  savedJobIds?: readonly string[];
  trackedJobIds?: readonly string[];
};

export type RankedHomeJob = {
  job: Job;
  score: number;
  distanceKm: number | null;
};

export type SelectUpcomingDeadlinesInput = {
  favorites: readonly FavoriteJob[];
  applications?: readonly TrackedApplication[];
  now?: Date;
};

export type UpcomingHomeDeadline = {
  favorite: FavoriteJob;
  job: Job;
  expiresAt: Date;
  applicationStatus: ApplicationStatus | null;
};

export type HomeSectionState = 'loading' | 'error' | 'empty' | 'ready';

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function updatedThenId(left: Job, right: Job): number {
  return timestamp(right.updatedAt) - timestamp(left.updatedAt)
    || left.id.localeCompare(right.id);
}

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getHomeJobDistanceKm(
  job: Pick<Job, 'latitude' | 'longitude'>,
  coordinates?: HomeCoordinates | null,
): number | null {
  if (
    !coordinates
    || !isFiniteCoordinate(coordinates.latitude)
    || !isFiniteCoordinate(coordinates.longitude)
    || !isFiniteCoordinate(job.latitude)
    || !isFiniteCoordinate(job.longitude)
  ) return null;

  const dLatitude = ((job.latitude - coordinates.latitude) * Math.PI) / 180;
  const dLongitude = ((job.longitude - coordinates.longitude) * Math.PI) / 180;
  const originLatitude = (coordinates.latitude * Math.PI) / 180;
  const jobLatitude = (job.latitude * Math.PI) / 180;
  const haversine = Math.sin(dLatitude / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(jobLatitude) * Math.sin(dLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function scoreHomeJob(job: Job, context: HomeJobScoreContext = {}): number {
  const interests = new Set((context.interestCategories ?? []).map(normalized).filter(Boolean));
  const distanceKm = getHomeJobDistanceKm(job, context.coordinates);
  const now = (context.now ?? new Date()).getTime();
  const updatedAt = timestamp(job.updatedAt);
  const age = now - updatedAt;
  let score = interests.has(normalized(job.category)) ? 4 : 0;

  if (distanceKm !== null) {
    if (distanceKm <= 25) score += 3;
    else if (distanceKm <= 50) score += 2;
    else if (distanceKm <= 100) score += 1;
  }

  if (age >= 0 && age <= 7 * DAY_MS) score += 2;
  else if (age >= 0 && age <= 30 * DAY_MS) score += 1;

  return score;
}

export function rankHomeJobs(input: RankHomeJobsInput): RankedHomeJob[] {
  const excludedIds = new Set([...(input.savedJobIds ?? []), ...(input.trackedJobIds ?? [])]);
  const selectedCountry = normalized(input.country);
  const uniqueEligibleJobs = new Map<string, Job>();

  for (const job of input.jobs) {
    if (
      !uniqueEligibleJobs.has(job.id)
      && job.status === 'active'
      && normalized(job.country) === selectedCountry
      && !excludedIds.has(job.id)
    ) uniqueEligibleJobs.set(job.id, job);
  }

  const eligible = [...uniqueEligibleJobs.values()];
  const scored = eligible.map((job) => ({
    job,
    score: scoreHomeJob(job, input),
    distanceKm: getHomeJobDistanceKm(job, input.coordinates),
  }));
  const ranked = scored
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || updatedThenId(left.job, right.job))
    .slice(0, MAX_RECOMMENDATIONS);

  if (ranked.length >= MIN_RECOMMENDATIONS_WITH_FALLBACK) return ranked;

  const rankedIds = new Set(ranked.map(({ job }) => job.id));
  const fallback = scored
    .filter(({ job }) => !rankedIds.has(job.id))
    .sort((left, right) => updatedThenId(left.job, right.job))
    .slice(0, MIN_RECOMMENDATIONS_WITH_FALLBACK - ranked.length);

  return [...ranked, ...fallback];
}

export function selectUpcomingDeadlines(input: SelectUpcomingDeadlinesInput): UpcomingHomeDeadline[] {
  const now = (input.now ?? new Date()).getTime();
  const deadlineLimit = now + DEADLINE_WINDOW_MS;
  const statusByJobId = new Map((input.applications ?? []).map((application) => [application.jobId, application.status]));
  const seenJobIds = new Set<string>();
  const deadlines: UpcomingHomeDeadline[] = [];

  for (const favorite of input.favorites) {
    const job = favorite.job;
    if (!job || seenJobIds.has(job.id) || !job.expiresAt) continue;

    const expiresAtTimestamp = timestamp(job.expiresAt);
    const applicationStatus = statusByJobId.get(job.id) ?? null;
    if (
      expiresAtTimestamp <= now
      || expiresAtTimestamp > deadlineLimit
      || (applicationStatus !== null && DEADLINE_EXCLUDED_STATUSES.has(applicationStatus))
    ) continue;

    seenJobIds.add(job.id);
    deadlines.push({
      favorite,
      job,
      expiresAt: new Date(expiresAtTimestamp),
      applicationStatus,
    });
  }

  return deadlines
    .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime() || left.job.id.localeCompare(right.job.id))
    .slice(0, MAX_UPCOMING_DEADLINES);
}

export function getHomeSectionState(input: {
  loading: boolean;
  error: unknown;
  itemCount: number;
}): HomeSectionState {
  if (input.itemCount > 0) return 'ready';
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  return 'empty';
}
