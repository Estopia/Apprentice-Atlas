import { describe, expect, it } from 'vitest';

import { buildJobDeepLink, buildJobShareCopy, isShareableJobId } from '../src/lib/job-sharing';

const job = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  title: 'Software Apprentice',
  company: 'Example Engineering',
  city: 'Berlin',
  country: 'Germany',
  sourceName: 'Bundesagentur für Arbeit',
};

describe('job sharing helpers', () => {
  it('accepts only complete RFC 4122 UUID-shaped job identifiers', () => {
    expect(isShareableJobId(job.id)).toBe(true);
    expect(isShareableJobId(job.id.toUpperCase())).toBe(true);
    for (const invalid of [
      '',
      '123e4567-e89b-02d3-a456-426614174000',
      '123e4567-e89b-42d3-7456-426614174000',
      `${job.id}/extra`,
      `${job.id}?redirect=https://example.com`,
      'not-a-uuid',
    ]) expect(isShareableJobId(invalid)).toBe(false);
  });

  it('builds only canonical Apprentice Atlas deep links', () => {
    expect(buildJobDeepLink(job.id.toUpperCase())).toBe(`apprenticeatlas://job/${job.id}`);
    expect(buildJobDeepLink(`${job.id}/../../settings`)).toBeNull();
  });

  it('builds deterministic German copy with explicit source attribution', () => {
    expect(buildJobShareCopy({ job, locale: 'de' })).toEqual({
      title: 'Software Apprentice',
      location: 'Berlin, Deutschland',
      sourceAttribution: 'Quelle: Bundesagentur für Arbeit',
      deepLink: `apprenticeatlas://job/${job.id}`,
      message: `Software Apprentice bei Example Engineering\nBerlin, Deutschland\nQuelle: Bundesagentur für Arbeit\napprenticeatlas://job/${job.id}\n\nGeteilt mit Apprentice Atlas`,
    });
  });

  it('builds deterministic English copy without descriptions or invented claims', () => {
    const copy = buildJobShareCopy({
      locale: 'en',
      job: { ...job, country: 'United Kingdom', city: 'Leeds', rawDescription: 'private raw listing text' } as never,
    });

    expect(copy).toEqual({
      title: 'Software Apprentice',
      location: 'Leeds, United Kingdom',
      sourceAttribution: 'Source: Bundesagentur für Arbeit',
      deepLink: `apprenticeatlas://job/${job.id}`,
      message: `Software Apprentice at Example Engineering\nLeeds, United Kingdom\nSource: Bundesagentur für Arbeit\napprenticeatlas://job/${job.id}\n\nShared with Apprentice Atlas`,
    });
    expect(JSON.stringify(copy)).not.toContain('private raw listing text');
    expect(buildJobShareCopy({ job: { ...job, id: 'unsafe' }, locale: 'en' })).toBeNull();
  });
});
