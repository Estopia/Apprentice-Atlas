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

  it('normalizes case and surrounding whitespace and rejects blank values', () => {
    expect(normalizeJobLevel(' ENTRY ')).toBe('entry-level');
    expect(normalizeJobLevel(' Entry-Level ')).toBe('entry-level');
    expect(normalizeJobLevel(' INTERMEDIATE ')).toBe('intermediate');
    expect(normalizeJobLevel('   ')).toBe('unknown');
  });
});

describe('cleanJobDescription', () => {
  it('removes common emphasis markers and preserves paragraphs and list lines', () => {
    const raw = '**Build your future**\n\n- Learn *modern* tools\n* Work with __supportive mentors__\n+ Grow _every_ day';

    expect(cleanJobDescription(raw)).toBe(
      'Build your future\n\n• Learn modern tools\n• Work with supportive mentors\n• Grow every day',
    );
  });

  it('returns plain text without interpreting HTML', () => {
    expect(cleanJobDescription('<strong>Safety</strong>\n\n- No **rendering**')).toBe(
      '<strong>Safety</strong>\n\n• No rendering',
    );
  });

  it('preserves literal underscores, asterisks, URLs, and unmatched delimiters', () => {
    const raw = 'Use snake_case_names at https://example.com/a_b_c and calculate 2*3*4.\nKeep *unmatched, __open, and `unfinished.';

    expect(cleanJobDescription(raw)).toBe(raw);
  });

  it('preserves dunder identifiers and dunders inside raw URLs', () => {
    const raw = 'Call __init__ before opening https://example.com/docs/__init__?next=__name__.';

    expect(cleanJobDescription(raw)).toBe(raw);
  });

  it('renders escaped Markdown delimiters literally', () => {
    const raw = 'Keep \\*literal\\*, \\_literal\\_, and \\~\\~literal\\~\\~ exactly.';

    expect(cleanJobDescription(raw)).toBe('Keep *literal*, _literal_, and ~~literal~~ exactly.');
  });

  it('removes matched code fences and strikethrough markers while preserving content', () => {
    const raw = 'Before\n\n```python\nclass Example:\n    def __init__(self):\n        return "2*3*4"\n```\n\nUse ~~legacy behavior~~ only when required.';

    expect(cleanJobDescription(raw)).toBe(
      'Before\n\nclass Example:\n    def __init__(self):\n        return "2*3*4"\n\nUse legacy behavior only when required.',
    );
  });

  it('converts common block and inline Markdown conservatively', () => {
    const raw = '# Role overview\n> Build `snake_case_names` at [Atlas](https://example.com/a_b_c).\n\n- ***Learn quickly***\n- **Work with *supportive* mentors**';

    expect(cleanJobDescription(raw)).toBe(
      'Role overview\nBuild snake_case_names at Atlas (https://example.com/a_b_c).\n\n• Learn quickly\n• Work with supportive mentors',
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

  it.each([
    ['de', 'Für Einsteiger', 'Mit erster Erfahrung', 'Erfahrungslevel nicht verfügbar'],
    ['en', 'Beginner friendly', 'Some experience', 'Experience level unavailable'],
  ] as const)('normalizes case, whitespace, intermediate, and blanks in %s', (locale, beginner, intermediate, fallback) => {
    expect(localizeJobLevel(locale, ' ENTRY ')).toBe(beginner);
    expect(localizeJobLevel(locale, ' Entry-Level ')).toBe(beginner);
    expect(localizeJobLevel(locale, ' INTERMEDIATE ')).toBe(intermediate);
    expect(localizeJobLevel(locale, '   ')).toBe(fallback);
  });
});
