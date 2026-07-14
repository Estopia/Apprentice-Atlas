import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

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
});
