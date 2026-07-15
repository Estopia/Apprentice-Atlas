import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import * as applicationFlow from '../src/lib/application-flow';
import * as reminders from '../src/lib/deadline-reminders';
import * as favorites from '../src/lib/favorites';

const jobId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

describe('interview date behavior', () => {
  it('accepts only a valid future picker selection and returns canonical ISO', () => {
    const normalize = (applicationFlow as unknown as {
      normalizeInterviewDateSelection?: (value: Date, now: Date) => string | null;
    }).normalizeInterviewDateSelection;

    expect(normalize).toBeTypeOf('function');
    if (!normalize) return;

    const now = new Date('2026-07-15T10:00:00.000Z');
    expect(normalize(new Date('2026-07-15T10:01:00.000Z'), now)).toBe('2026-07-15T10:01:00.000Z');
    expect(normalize(new Date('2026-07-15T09:59:59.000Z'), now)).toBeNull();
    expect(normalize(new Date('invalid'), now)).toBeNull();
  });
});

describe('saved deadline reminder reconciliation', () => {
  it('schedules only for saved jobs before applied and cancels every other state', async () => {
    const reconcile = (reminders as unknown as {
      reconcileDeadlineReminder?: (input: Record<string, unknown>) => Promise<{ state: string }>;
    }).reconcileDeadlineReminder;
    expect(reconcile).toBeTypeOf('function');
    if (!reconcile) return;

    const schedule = vi.fn(async () => ({ state: 'scheduled', notificationId: 'notification-1' }));
    const cancel = vi.fn(async () => true);
    const base = {
      userId,
      jobId,
      deadlineAt: '2026-07-22T10:00:00.000Z',
      title: 'Application deadline',
      body: 'Three days remain.',
      now: new Date('2026-07-15T10:00:00.000Z'),
      schedule,
      cancel,
    };

    await expect(reconcile({ ...base, saved: true, applicationStatus: 'preparing' }))
      .resolves.toMatchObject({ state: 'scheduled' });
    expect(schedule).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();

    for (const applicationStatus of ['applied', 'interview', 'offer', 'closed']) {
      await expect(reconcile({ ...base, saved: true, applicationStatus }))
        .resolves.toEqual({ state: 'not-scheduled', notificationId: null });
    }
    await expect(reconcile({ ...base, saved: false, applicationStatus: 'preparing' }))
      .resolves.toEqual({ state: 'not-scheduled', notificationId: null });
    expect(cancel).toHaveBeenCalledTimes(5);
  });

  it('does not reject the saved-state operation when notification permission is denied', async () => {
    const reconcile = (reminders as unknown as {
      reconcileDeadlineReminder?: (input: Record<string, unknown>) => Promise<{ state: string }>;
    }).reconcileDeadlineReminder;
    expect(reconcile).toBeTypeOf('function');
    if (!reconcile) return;

    await expect(reconcile({
      userId,
      jobId,
      deadlineAt: '2026-07-22T10:00:00.000Z',
      applicationStatus: null,
      saved: true,
      title: 'Application deadline',
      body: 'Three days remain.',
      now: new Date('2026-07-15T10:00:00.000Z'),
      schedule: vi.fn(async () => ({ state: 'permission-denied', notificationId: null })),
      cancel: vi.fn(async () => false),
    })).resolves.toEqual({ state: 'permission-denied', notificationId: null });
  });

  it('localizes notification copy and includes only the official job title', () => {
    const buildCopy = (favorites as unknown as {
      buildDeadlineReminderCopy?: (locale: 'de' | 'en', title: string) => { title: string; body: string };
    }).buildDeadlineReminderCopy;
    expect(buildCopy).toBeTypeOf('function');
    if (!buildCopy) return;

    expect(buildCopy('de', 'Fachinformatiker:in')).toEqual({
      title: 'Bewerbungsfrist',
      body: 'Noch drei Tage für Fachinformatiker:in.',
    });
    expect(buildCopy('en', 'Software Apprentice')).toEqual({
      title: 'Application deadline',
      body: 'Three days remain for Software Apprentice.',
    });
  });
});

describe('Task 3 native integration source contracts', () => {
  it('uses the picker, restrained motion, haptics, calendar handoff, and delayed standard review request', () => {
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');

    expect(sheet).toMatch(/@react-native-community\/datetimepicker/);
    expect(sheet).toMatch(/normalizeInterviewDateSelection/);
    expect(sheet).toMatch(/minimumDate=/);
    expect(sheet).toMatch(/application\.clearInterviewDate/);
    expect(sheet).toMatch(/react-native-reanimated/);
    expect(sheet).toMatch(/FadeIn|LinearTransition/);
    expect(sheet).toMatch(/selectionFeedback/);
    expect(sheet).toMatch(/successFeedback/);
    expect(sheet).toMatch(/errorFeedback/);
    expect(sheet).toMatch(/buildCalendarEventPayload\('interview'/);
    expect(sheet).toMatch(/openCalendarEventForm/);
    expect(sheet).toMatch(/setTimeout[\s\S]+requestAppReviewAfterOfferTransition/);
  });

  it('reconciles reminders after persisted saves, unsaves, and applied-or-later statuses', () => {
    const sheet = readFileSync('src/app/application/[jobId].tsx', 'utf8');
    const detail = readFileSync('src/app/job/[id].tsx', 'utf8');
    const saved = readFileSync('src/app/(tabs)/favorites.tsx', 'utf8');

    expect(sheet).toMatch(/result\.error[\s\S]+reconcileDeadlineReminder/);
    expect(detail).toMatch(/addFavorite[\s\S]+result\.error[\s\S]+reconcileDeadlineReminder/);
    expect(detail).toMatch(/removeFavorite[\s\S]+result\.error[\s\S]+reconcileDeadlineReminder/);
    expect(saved).toMatch(/removeFavorite[\s\S]+result\.error[\s\S]+reconcileDeadlineReminder/);
  });

  it('covers every favorite entry point through the shared favorite operations', () => {
    const favoritesSource = readFileSync('src/lib/favorites.ts', 'utf8');
    const addBlock = favoritesSource.slice(favoritesSource.indexOf('export async function addFavorite'), favoritesSource.indexOf('export async function removeFavorite'));
    const removeBlock = favoritesSource.slice(favoritesSource.indexOf('export async function removeFavorite'), favoritesSource.indexOf('export function dedupeFavorites'));

    expect(addBlock).toMatch(/result\.error[\s\S]+reconcileSavedFavoriteDeadline/);
    expect(removeBlock).toMatch(/result\.error[\s\S]+cancelDeadlineReminder/);
    expect(addBlock).not.toMatch(/await reconcileSavedFavoriteDeadline/);
    expect(removeBlock).not.toMatch(/await cancelDeadlineReminder/);
  });

  it('surfaces official deadline and reminder state without invented contact fields', () => {
    const detail = readFileSync('src/app/job/[id].tsx', 'utf8');
    const saved = readFileSync('src/app/(tabs)/favorites.tsx', 'utf8');

    expect(detail).toMatch(/buildCalendarEventPayload\('deadline'/);
    expect(detail).toMatch(/deadline\.reminder\.permissionDenied/);
    expect(saved).toMatch(/deadline\.reminder\.permissionDenied/);
    expect(detail).not.toMatch(/contactEmail|attendees|organizer/);
    expect(saved).not.toMatch(/contactEmail|attendees|organizer/);
  });

  it('does not show one account reminder state while another account is loading', () => {
    const detail = readFileSync('src/app/job/[id].tsx', 'utf8');
    const saved = readFileSync('src/app/(tabs)/favorites.tsx', 'utf8');
    const detailReminderLoad = detail.slice(detail.indexOf('void getDeadlineReminderState') - 120, detail.indexOf('void getDeadlineReminderState') + 320);
    const savedLoad = saved.slice(saved.indexOf('const loadFavorites'), saved.indexOf('void listFavorites') + 24);

    expect(detailReminderLoad).toMatch(/setReminderState\('not-scheduled'\)[\s\S]+getDeadlineReminderState/);
    expect(savedLoad).toMatch(/setReminderStates\(\{\}\)[\s\S]+listFavorites/);
  });
});
