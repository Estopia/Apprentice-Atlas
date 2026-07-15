import { describe, expect, it } from 'vitest';

import {
  getHomeSectionState,
  rankHomeJobs,
  scoreHomeJob,
  selectUpcomingDeadlines,
} from '../src/lib/home-presentation';
import type { FavoriteJob, Job, TrackedApplication } from '../src/types/jobs';

const NOW = new Date('2026-07-16T12:00:00.000Z');

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: `Job ${id}`,
    company: 'Atlas',
    country: 'Germany',
    city: 'Berlin',
    latitude: null,
    longitude: null,
    jobType: 'apprenticeship',
    level: 'entry',
    category: 'technology',
    tags: [],
    rawDescription: '',
    requirements: [],
    sourceUrl: null,
    applicationUrl: null,
    sourceName: 'test',
    status: 'active',
    lastSeenAt: NOW.toISOString(),
    expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function favorite(favoriteJob: Job): FavoriteJob {
  return {
    id: `favorite-${favoriteJob.id}`,
    userId: 'user-1',
    jobId: favoriteJob.id,
    createdAt: NOW.toISOString(),
    job: favoriteJob,
  };
}

function application(jobId: string, status: TrackedApplication['status']): TrackedApplication {
  return {
    id: `application-${jobId}`,
    userId: 'user-1',
    jobId,
    status,
    note: null,
    interviewAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe('home recommendations', () => {
  it('hard-filters inactive, other-country, saved, and tracked jobs', () => {
    const jobs = [
      job('eligible', { updatedAt: '2026-07-15T12:00:00.000Z' }),
      job('expired', { status: 'expired' }),
      job('uk', { country: 'United Kingdom' }),
      job('saved'),
      job('tracked'),
    ];

    expect(rankHomeJobs({
      jobs,
      country: 'Germany',
      interestCategories: ['technology'],
      savedJobIds: ['saved'],
      trackedJobIds: ['tracked'],
      now: NOW,
    }).map(({ job: rankedJob }) => rankedJob.id)).toEqual(['eligible']);
  });

  it('uses the fixed interest, distance, and freshness score boundaries', () => {
    const context = {
      interestCategories: ['technology'],
      coordinates: { latitude: 52.52, longitude: 13.405 },
      now: NOW,
    };

    expect(scoreHomeJob(job('near-fresh', {
      latitude: 52.52,
      longitude: 13.405,
      updatedAt: '2026-07-09T12:00:00.000Z',
    }), context)).toBe(9);
    expect(scoreHomeJob(job('mid-month', {
      category: 'healthcare',
      latitude: 52.88,
      longitude: 13.405,
      updatedAt: '2026-06-16T12:00:00.000Z',
    }), context)).toBe(3);
    expect(scoreHomeJob(job('far-old', {
      category: 'healthcare',
      latitude: 53.32,
      longitude: 13.405,
      updatedAt: '2026-06-15T11:59:59.000Z',
    }), context)).toBe(1);
    expect(scoreHomeJob(job('no-location', {
      updatedAt: '2026-07-16T12:00:00.000Z',
    }), { ...context, interestCategories: [] })).toBe(2);
  });

  it('orders score ties by updatedAt descending then id ascending and caps at six', () => {
    const jobs = ['g', 'f', 'e', 'd', 'c', 'b', 'a'].map((id) => job(id, {
      updatedAt: id === 'a' || id === 'b'
        ? '2026-07-15T12:00:00.000Z'
        : '2026-07-14T12:00:00.000Z',
    }));

    const ranked = rankHomeJobs({
      jobs,
      country: 'Germany',
      interestCategories: ['technology'],
      now: NOW,
    });

    expect(ranked).toHaveLength(6);
    expect(ranked.map(({ job: rankedJob }) => rankedJob.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('fills fewer than four scored matches with the newest unique eligible jobs', () => {
    const ranked = rankHomeJobs({
      jobs: [
        job('match', { category: 'technology', updatedAt: '2026-06-01T00:00:00.000Z' }),
        job('newest', { category: 'healthcare', updatedAt: '2026-06-15T00:00:00.000Z' }),
        job('next', { category: 'finance', updatedAt: '2026-06-14T00:00:00.000Z' }),
        job('oldest', { category: 'retail', updatedAt: '2026-06-13T00:00:00.000Z' }),
        job('saved-new', { category: 'retail', updatedAt: '2026-07-15T00:00:00.000Z' }),
      ],
      country: 'Germany',
      interestCategories: ['technology'],
      savedJobIds: ['saved-new'],
      now: NOW,
    });

    expect(ranked.map(({ job: rankedJob }) => rankedJob.id)).toEqual(['match', 'newest', 'next', 'oldest']);
    expect(ranked.map(({ score }) => score)).toEqual([4, 0, 0, 0]);
  });
});

describe('home deadlines and section state', () => {
  it('selects at most three saved deadlines in the next fourteen days before application', () => {
    const favorites = [
      favorite(job('later', { expiresAt: '2026-07-30T12:00:00.000Z' })),
      favorite(job('soon', { expiresAt: '2026-07-17T12:00:00.000Z' })),
      favorite(job('middle', { expiresAt: '2026-07-20T12:00:00.000Z' })),
      favorite(job('fourth', { expiresAt: '2026-07-25T12:00:00.000Z' })),
      favorite(job('past', { expiresAt: NOW.toISOString() })),
      favorite(job('too-late', { expiresAt: '2026-07-30T12:00:00.001Z' })),
      favorite(job('applied', { expiresAt: '2026-07-18T12:00:00.000Z' })),
      favorite(job('interview', { expiresAt: '2026-07-17T06:00:00.000Z' })),
      favorite(job('offer', { expiresAt: '2026-07-17T07:00:00.000Z' })),
      favorite(job('closed', { expiresAt: '2026-07-17T08:00:00.000Z' })),
      favorite(job('preparing', { expiresAt: '2026-07-19T12:00:00.000Z' })),
    ];

    const deadlines = selectUpcomingDeadlines({
      favorites,
      applications: [
        application('applied', 'applied'),
        application('interview', 'interview'),
        application('offer', 'offer'),
        application('closed', 'closed'),
        application('preparing', 'preparing'),
      ],
      now: NOW,
    });

    expect(deadlines.map(({ job: deadlineJob }) => deadlineJob.id)).toEqual(['soon', 'preparing', 'middle']);
  });

  it('derives small deterministic states for independently rendered sections', () => {
    expect(getHomeSectionState({ loading: true, error: null, itemCount: 0 })).toBe('loading');
    expect(getHomeSectionState({ loading: false, error: new Error('offline'), itemCount: 0 })).toBe('error');
    expect(getHomeSectionState({ loading: false, error: null, itemCount: 0 })).toBe('empty');
    expect(getHomeSectionState({ loading: false, error: new Error('stale'), itemCount: 2 })).toBe('ready');
  });
});
