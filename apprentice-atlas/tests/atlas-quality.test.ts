import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { deriveAtlasNextAction } from '../src/lib/atlas-next-action';
import type { ApplicationStatus, TrackedApplication } from '../src/types/jobs';

const read = (path: string) => readFileSync(path, 'utf8');

const application = (status: ApplicationStatus, updatedAt: string, id: string = status): TrackedApplication => ({
  id,
  userId: 'user-1',
  jobId: `job-${id}`,
  status,
  note: null,
  createdAt: updatedAt,
  updatedAt,
});

describe('My Atlas quality contracts', () => {
  it('refreshes on focus with a stable callback, cleanup, retry, and session-isolated state', () => {
    const screen = read('src/app/(tabs)/atlas.tsx');

    expect(screen).toMatch(/useFocusEffect/);
    expect(screen).toMatch(/const loadApplications = useCallback/);
    expect(screen).toMatch(/useFocusEffect\(loadApplications\)/);
    expect(screen).toMatch(/let active = true;[\s\S]+if \(!active[^)]*\) return;[\s\S]+active = false;/);
    expect(screen).toMatch(/loadedForSessionKey === sessionKey/);
    expect(screen).toMatch(/setLoadedForSessionKey\(null\);[\s\S]+setLoadAttempt/);
  });

  it('keeps all three web tabs fluid within a padded 320px viewport', () => {
    const tabs = read('src/components/app-tabs.web.tsx');

    expect(tabs).toMatch(/tabListContainer: \{[^\n]+paddingHorizontal:/);
    expect(tabs).toMatch(/innerContainer: \{[^\n]+width: '100%'[^\n]+maxWidth:/);
    expect(tabs).toMatch(/tabButton: \{[^\n]+flex: 1[^\n]+minWidth: 0/);
    expect(tabs).not.toMatch(/tabButton: \{[^\n]+width: \d+/);
  });

  it('uses a safe timestamp and localized fallback for malformed update dates', () => {
    const screen = read('src/app/(tabs)/atlas.tsx');
    const messages = read('src/lib/i18n.ts');

    expect(screen).toMatch(/safeTimestamp\(application\.updatedAt\)/);
    expect(screen).toMatch(/atlas\.updatedFallback/);
    expect(messages.match(/'atlas\.updatedFallback':/g)).toHaveLength(2);
  });

  it('opens every application row in its application sheet by the stored job id', () => {
    const screen = read('src/app/(tabs)/atlas.tsx');
    const applicationRow = screen.slice(screen.indexOf('function ApplicationRow'), screen.indexOf('function PreferenceRow'));

    expect(applicationRow).toMatch(/accessibilityRole="button"/);
    expect(applicationRow).not.toMatch(/disabled=\{!job\}/);
    expect(applicationRow).toMatch(/onPress=\{\(\) => router\.push\(\{ pathname: '\/application\/\[jobId\]', params: \{ jobId: application\.jobId \} \} as never\)\}/);
  });

  it('keeps Saved opportunity-only and renders its title before every state branch', () => {
    const screen = read('src/app/(tabs)/favorites.tsx');
    const screenBody = screen.slice(screen.indexOf('export default function FavoritesScreen'), screen.indexOf('function FavoriteCard'));

    expect(screenBody.indexOf("t(locale, 'saved.title')")).toBeLessThan(screenBody.indexOf('loading ?'));
    expect(screenBody).toMatch(/savedCountText/);
    expect(screen).not.toMatch(/invokeSignOut|getReadableAuthError|saved\.account|auth\.signOut/);
  });

  it('prevents an older focus refresh from restoring an optimistically removed favorite', () => {
    const screen = read('src/app/(tabs)/favorites.tsx');

    expect(screen).toMatch(/const listRevisionRef = useRef\(0\)/);
    expect(screen).toMatch(/const listRevision = \+\+listRevisionRef\.current/);
    expect(screen).toMatch(/listRevision !== listRevisionRef\.current/);
    expect(screen).toMatch(/const remove = async[\s\S]+listRevisionRef\.current \+= 1/);
  });

  it('keeps language out of discovery filters and uses an honest results action', () => {
    const screen = read('src/app/filters.tsx');

    expect(screen).not.toMatch(/usePreferences|savePreferences|discovery\.language/);
    expect(screen).toMatch(/discovery\.activeFilters/);
    expect(screen).toMatch(/discovery\.showResults/);
  });

  it('uses the ScrollView as the native form-sheet root instead of nesting it behind an absolute footer', () => {
    const screen = read('src/app/filters.tsx');

    expect(screen).toMatch(/return \(\s*<>\s*<ScrollView style=\{styles\.screen\}/);
    expect(screen).toMatch(/content: \{ flexGrow: 1/);
    expect(screen).not.toMatch(/footer: \{ position: 'absolute'/);
  });

  it('derives one deterministic, action-first recommendation from application progress', () => {
    expect(deriveAtlasNextAction([])).toEqual({ kind: 'discover', application: null });

    const preparing = application('preparing', '2026-07-10T10:00:00.000Z');
    const interview = application('interview', '2026-07-09T10:00:00.000Z');
    const newerInterview = application('interview', '2026-07-11T10:00:00.000Z', 'newer-interview');
    const closed = application('closed', '2026-07-12T10:00:00.000Z');

    expect(deriveAtlasNextAction([preparing, interview, newerInterview, closed])).toEqual({
      kind: 'prepare-interview',
      application: newerInterview,
    });
  });

  it('gives offers priority and ignores finished applications for next actions', () => {
    const interested = application('interested', '2026-07-15T10:00:00.000Z');
    const offer = application('offer', '2026-07-01T10:00:00.000Z');

    expect(deriveAtlasNextAction([interested, offer]).kind).toBe('review-offer');
    expect(deriveAtlasNextAction([application('closed', '2026-07-15T10:00:00.000Z')])).toEqual({
      kind: 'discover',
      application: null,
    });
  });

  it('prioritizes the lifecycle in order from interested through offer', () => {
    const timestamp = '2026-07-15T10:00:00.000Z';
    const interested = application('interested', timestamp);
    const preparing = application('preparing', timestamp);
    const applied = application('applied', timestamp);
    const interview = application('interview', timestamp);
    const offer = application('offer', timestamp);

    expect(deriveAtlasNextAction([interested, preparing]).application).toBe(preparing);
    expect(deriveAtlasNextAction([preparing, applied]).application).toBe(applied);
    expect(deriveAtlasNextAction([applied, interview]).application).toBe(interview);
    expect(deriveAtlasNextAction([interview, offer]).application).toBe(offer);
  });

  it('uses accessible responsive two-column Atlas metrics', () => {
    const screen = read('src/app/(tabs)/atlas.tsx');
    const progress = screen.slice(screen.indexOf('function ProgressOverview'), screen.indexOf('function ApplicationSection'));
    const styles = screen.slice(screen.indexOf('const styles = StyleSheet.create'));

    expect(progress).toContain('accessibilityLabel={`${label}: ${value}`}');
    expect(progress).not.toContain('numberOfLines={1}');
    expect(styles).toContain("metricsRow: { flexDirection: 'row', flexWrap: 'wrap'");
    expect(styles).toContain("metric: { width: '50%'");
  });

  it('keeps Task 3 action and journey copy complete in German and English', () => {
    const messages = read('src/lib/i18n.ts');
    const keys = [
      'discovery.activeFilters',
      'discovery.showResults',
      'atlas.nextAction',
      'atlas.next.discoverTitle',
      'atlas.next.interestedTitle',
      'atlas.next.preparingTitle',
      'atlas.next.appliedTitle',
      'atlas.next.interviewTitle',
      'atlas.next.offerTitle',
      'application.statusHint.interested',
      'application.statusHint.preparing',
      'application.statusHint.applied',
      'application.statusHint.interview',
      'application.statusHint.offer',
      'application.statusHint.closed',
    ];

    keys.forEach((key) => expect(messages.match(new RegExp(`'${key}':`, 'g'))).toHaveLength(2));
  });
});
