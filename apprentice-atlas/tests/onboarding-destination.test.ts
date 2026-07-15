import { describe, expect, it } from 'vitest';

import {
  getOnboardingGateParams,
  getPostOnboardingDestination,
} from '../src/lib/onboarding-destination';

const jobId = '11111111-1111-4111-8111-111111111111';
const otherJobId = '22222222-2222-4222-8222-222222222222';

describe('safe onboarding destinations', () => {
  it('preserves only exact Atlas and valid local job launch paths', () => {
    expect(getOnboardingGateParams('/atlas', {})).toEqual({ returnTo: '/atlas' });
    expect(getOnboardingGateParams('/map', {})).toEqual({ returnTo: '/map' });
    expect(getOnboardingGateParams('/search', {})).toEqual({ returnTo: '/search' });
    expect(getOnboardingGateParams(`/job/${jobId}`, {})).toEqual({ returnTo: `/job/${jobId}` });
    expect(getOnboardingGateParams('/job/not-a-uuid', {})).toEqual({});
    expect(getOnboardingGateParams('https://evil.test/steal', {})).toEqual({});
  });

  it('preserves an auth launch only when its track or save action exactly matches the return job', () => {
    expect(getOnboardingGateParams('/auth', {
      pendingAction: 'track',
      jobId,
      returnTo: `/job/${jobId}`,
    })).toEqual({ pendingAction: 'track', jobId, returnTo: `/job/${jobId}` });
    expect(getOnboardingGateParams('/auth', {
      pendingAction: 'save',
      jobId,
      returnTo: `/job/${jobId}`,
    })).toEqual({ pendingAction: 'save', jobId, returnTo: `/job/${jobId}` });
    expect(getOnboardingGateParams('/auth', {
      pendingAction: 'save',
      jobId,
      returnTo: `/job/${otherJobId}`,
    })).toEqual({});
    expect(getOnboardingGateParams('/auth', {
      pendingAction: 'delete',
      jobId,
      returnTo: `/job/${jobId}`,
    })).toEqual({});
    expect(getOnboardingGateParams('/auth', {
      pendingAction: ['save'],
      jobId,
      returnTo: `/job/${jobId}`,
    })).toEqual({});
  });

  it('resumes a validated first-run destination after onboarding', () => {
    expect(getPostOnboardingDestination({ returnTo: '/atlas' }, false)).toBe('/atlas');
    expect(getPostOnboardingDestination({ returnTo: `/job/${jobId}` }, false)).toBe(`/job/${jobId}`);
    expect(getPostOnboardingDestination({
      pendingAction: 'track',
      jobId,
      returnTo: `/job/${jobId}`,
    }, false)).toEqual({
      pathname: '/auth',
      params: { pendingAction: 'track', jobId, returnTo: `/job/${jobId}` },
    });
    expect(getPostOnboardingDestination({
      pendingAction: 'save',
      jobId,
      returnTo: `/job/${jobId}`,
    }, false)).toEqual({
      pathname: '/auth',
      params: { pendingAction: 'save', jobId, returnTo: `/job/${jobId}` },
    });
  });

  it('falls home for edited preferences and any unchecked continuation parameters', () => {
    expect(getPostOnboardingDestination({ returnTo: '/atlas' }, true)).toBe('/');
    expect(getPostOnboardingDestination({ returnTo: 'https://evil.test/steal' }, false)).toBe('/');
    expect(getPostOnboardingDestination({
      pendingAction: 'delete',
      jobId,
      returnTo: `/job/${jobId}`,
    }, false)).toBe('/');
    expect(getPostOnboardingDestination({
      pendingAction: 'save',
      jobId,
      returnTo: `/job/${otherJobId}`,
    }, false)).toBe('/');
    expect(getPostOnboardingDestination({
      pendingAction: ['save'],
      jobId,
      returnTo: `/job/${jobId}`,
    }, false)).toBe('/');
  });
});
