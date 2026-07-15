import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('interactive hit-area contracts', () => {
  it('keeps the reviewed web controls at explicit 44x44 minimums with semantics', () => {
    const controls = [
      ['src/components/jobs/job-qa.tsx', /accessibilityRole="button"[\s\S]+minHeight: 44[\s\S]+minWidth: 44/],
      ['src/app/(tabs)/index.tsx', /retry: \{ minHeight: 44/],
      ['src/app/(tabs)/favorites.tsx', /saved.remove[\s\S]+minHeight: 44[\s\S]+minWidth: 44/],
      ['src/app/job/[id].tsx', /Stack\.Screen[\s\S]+headerBackButtonDisplayMode: 'minimal'/],
      ['src/components/app-tabs.web.tsx', /accessibilityRole="tab"[\s\S]+selected[\s\S]+minHeight: 44[\s\S]+flex: 1[\s\S]+minWidth: 0/],
      ['src/components/map/job-map.web.tsx', /accessibilityRole="button"[\s\S]+accessibilityState=\{\{ selected:[\s\S]+minHeight: 44[\s\S]+minWidth: 44/],
    ] as const;
    for (const [path, assertion] of controls) expect(read(path)).toMatch(assertion);
  });

  it('keeps discovery controls responsive and job facts contextual', () => {
    const discovery = read('src/app/(tabs)/index.tsx');
    const detail = read('src/app/job/[id].tsx');

    expect(discovery).toMatch(/kind="flexible"[\s\S]+kind="compact"[\s\S]+kind="compact"/);
    expect(discovery).toMatch(/controlFlexible: \{ flex: 1, minWidth: 0 \}/);
    expect(discovery).toMatch(/controlCompact: \{ flexShrink: 1, minWidth: 44, maxWidth: 96 \}/);
    expect(discovery).toMatch(/controlText: \{ flexShrink: 1, minWidth: 0,/);
    expect(detail).toContain("label={t(locale, 'discovery.category')}");
    expect(detail).toContain("label={t(locale, 'discovery.level')}");
    expect(detail).toMatch(/return <View accessible accessibilityLabel=\{`\$\{label\}: \$\{value\}`\}/);
  });
});
