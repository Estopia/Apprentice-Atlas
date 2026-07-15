import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
  },
}));

import { cleanJobDescription, normalizeJobLevel } from '../src/lib/job-presentation';
import { localizeJobLevel } from '../src/lib/i18n';

describe('normalizeJobLevel', () => {
  it('normalizes both API entry variants to entry-level', () => {
    expect(normalizeJobLevel('entry')).toBe('entry-level');
    expect(normalizeJobLevel('entry-level')).toBe('entry-level');
  });

  it('keeps intermediate and safely falls back for unknown input', () => {
    expect(normalizeJobLevel('intermediate')).toBe('intermediate');
    expect(normalizeJobLevel('senior_level')).toBe('unknown');
    expect(normalizeJobLevel(null)).toBe('unknown');
    expect(normalizeJobLevel(undefined)).toBe('unknown');
  });
});

describe('cleanJobDescription', () => {
  it('removes common emphasis markers and preserves paragraphs and list lines', () => {
    const raw = '**Build your future**\n\n- Learn *modern* tools\n* Work with __supportive__ mentors\n+ Grow _every_ day';

    expect(cleanJobDescription(raw)).toBe(
      'Build your future\n\n• Learn modern tools\n• Work with supportive mentors\n• Grow every day',
    );
  });

  it('returns plain text without interpreting HTML', () => {
    expect(cleanJobDescription('<strong>Safety</strong>\n\n- No **rendering**')).toBe(
      '<strong>Safety</strong>\n\n• No rendering',
    );
  });
});

describe('localizeJobLevel', () => {
  it('localizes entry and entry-level to the same beginner label', () => {
    expect(localizeJobLevel('de', 'entry')).toBe('Für Einsteiger');
    expect(localizeJobLevel('de', 'entry-level')).toBe('Für Einsteiger');
    expect(localizeJobLevel('en', 'entry')).toBe('Beginner friendly');
    expect(localizeJobLevel('en', 'entry-level')).toBe('Beginner friendly');
  });

  it('uses a localized fallback instead of leaking machine values', () => {
    expect(localizeJobLevel('de', 'senior_level')).toBe('Erfahrungslevel nicht verfügbar');
    expect(localizeJobLevel('en', 'senior_level')).toBe('Experience level unavailable');
  });
});

describe('beginner filter', () => {
  it('selects and emits the canonical entry-level value', () => {
    const filters = readFileSync(new URL('../src/app/filters.tsx', import.meta.url), 'utf8');

    expect(filters).toContain("filters.level === 'entry-level'");
    expect(filters).toContain("update({ level: 'entry-level' })");
  });
});
