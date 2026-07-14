import { describe, expect, it } from 'vitest';

import { groupApplications, summarizeApplications } from '../src/lib/atlas';
import type { ApplicationStatus, TrackedApplication } from '../src/types/jobs';

function application(id: string, status: ApplicationStatus, updatedAt: string): TrackedApplication {
  return {
    id,
    userId: '33333333-3333-4333-8333-333333333333',
    jobId: `11111111-1111-4111-8111-${id.padStart(12, '0')}`,
    status,
    note: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt,
  };
}

describe('Atlas application summary', () => {
  it('counts the complete pipeline and its meaningful milestones', () => {
    const applications = [
      application('1', 'interested', '2026-07-14T08:00:00.000Z'),
      application('2', 'preparing', '2026-07-14T09:00:00.000Z'),
      application('3', 'applied', '2026-07-14T10:00:00.000Z'),
      application('4', 'interview', '2026-07-14T11:00:00.000Z'),
      application('5', 'offer', '2026-07-14T12:00:00.000Z'),
      application('6', 'closed', '2026-07-14T13:00:00.000Z'),
    ];

    expect(summarizeApplications(applications)).toEqual({
      total: 6,
      active: 4,
      finished: 2,
      interviews: 1,
      offers: 1,
    });
    expect(summarizeApplications([])).toEqual({
      total: 0,
      active: 0,
      finished: 0,
      interviews: 0,
      offers: 0,
    });
  });

  it('groups pipeline states and orders each group by newest update without mutating input', () => {
    const applications = [
      application('1', 'closed', '2026-07-10T12:00:00.000Z'),
      application('2', 'interested', '2026-07-11T12:00:00.000Z'),
      application('3', 'offer', '2026-07-14T12:00:00.000Z'),
      application('4', 'interview', '2026-07-13T12:00:00.000Z'),
      application('5', 'applied', '2026-07-12T12:00:00.000Z'),
      application('6', 'preparing', '2026-07-14T08:00:00.000Z'),
    ];
    const originalOrder = applications.map(({ id }) => id);

    const grouped = groupApplications(applications);

    expect(grouped.active.map(({ id }) => id)).toEqual(['6', '4', '5', '2']);
    expect(grouped.finished.map(({ id }) => id)).toEqual(['3', '1']);
    expect(applications.map(({ id }) => id)).toEqual(originalOrder);
  });
});
