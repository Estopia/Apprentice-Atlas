import { describe, expect, it } from 'vitest';

import { buildAccountPdfHtml, type AccountExport } from '../src/lib/account';

const unsafeExport = {
  format: 'apprentice-atlas-account-export',
  version: 1,
  exportedAt: '2026-07-15T12:00:00.000Z',
  account: {
    id: 'user-<admin>',
    email: 'alex&sam@example.com',
    createdAt: '2026-07-01T09:00:00.000Z',
    access_token: 'access-token-secret',
  },
  preferences: {
    onboardingComplete: true,
    audience: 'student',
    interests: ['technology', '<img src=x onerror=alert(1)>'],
    country: 'Germany',
    locale: 'en',
    careerProfile: 'career-profile-secret',
  },
  savedOpportunities: [{
    id: 'favorite-1',
    userId: 'user-1',
    jobId: '123e4567-e89b-42d3-a456-426614174000',
    createdAt: '2026-07-10T00:00:00.000Z',
    localNotificationId: 'notification-id-secret',
    job: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      title: 'Software <Apprentice>',
      company: 'A&B Engineering',
      city: 'Berlin',
      country: 'Germany',
      rawDescription: 'raw-secret-description',
      sourceName: 'Official Source',
    },
  }],
  applications: [{
    id: 'application-1',
    userId: 'user-1',
    jobId: '123e4567-e89b-42d3-a456-426614174001',
    status: 'interview',
    note: 'Ask about R&D <team> & travel.',
    interviewAt: '2026-07-21T09:30:00.000Z',
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    job: {
      id: '123e4567-e89b-42d3-a456-426614174001',
      title: 'Mechanical Apprentice',
      company: 'Example Works',
      city: 'Leeds',
      country: 'United Kingdom',
      rawDescription: 'second-raw-secret-description',
      sourceName: 'Official Source',
    },
  }],
  authToken: 'root-token-secret',
  careerProfile: 'root-career-profile-secret',
} as unknown as AccountExport;

describe('account PDF HTML', () => {
  it('uses high-contrast A4 print styles and readable account sections', () => {
    const html = buildAccountPdfHtml(unsafeExport, 'en');

    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4/i);
    expect(html).toContain('background: #fff');
    expect(html).toContain('color: #111');
    expect(html).toContain('Apprentice Atlas account report');
    expect(html).toContain('Account');
    expect(html).toContain('Preferences');
    expect(html).toContain('Saved opportunities');
    expect(html).toContain('Applications');
    expect(html).toContain('alex&amp;sam@example.com');
    expect(html).toContain('user-&lt;admin&gt;');
    expect(html).toContain('Germany');
    expect(html).toContain('technology');
  });

  it('strictly escapes every included dynamic field', () => {
    const html = buildAccountPdfHtml(unsafeExport, 'en');

    expect(html).toContain('Software &lt;Apprentice&gt;');
    expect(html).toContain('A&amp;B Engineering');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Ask about R&amp;D &lt;team&gt; &amp; travel.');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<Apprentice>');
    expect(html).not.toContain('<team>');
  });

  it('includes useful saved and application fields without leaking excluded data', () => {
    const html = buildAccountPdfHtml(unsafeExport, 'en');

    expect(html).toContain('Software &lt;Apprentice&gt;');
    expect(html).toContain('Berlin, Germany');
    expect(html).toContain('Mechanical Apprentice');
    expect(html).toContain('Example Works');
    expect(html).toContain('Leeds, United Kingdom');
    expect(html).toContain('Interview');
    expect(html).toContain('21 Jul 2026');
    expect(html).toContain('Ask about R&amp;D &lt;team&gt; &amp; travel.');

    for (const secret of [
      'raw-secret-description',
      'second-raw-secret-description',
      'access-token-secret',
      'root-token-secret',
      'notification-id-secret',
      'career-profile-secret',
      'root-career-profile-secret',
    ]) expect(html).not.toContain(secret);
  });
});
