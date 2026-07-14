import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('interactive hit-area contracts', () => {
  it('keeps the reviewed web controls at explicit 44x44 minimums with semantics', () => {
    const controls = [
      ['src/components/jobs/job-qa.tsx', /accessibilityRole="button"[\s\S]+minHeight: 44[\s\S]+minWidth: 44/],
      ['src/app/(tabs)/favorites.tsx', /saved.remove[\s\S]+minHeight: 44[\s\S]+minWidth: 44/],
      ['src/app/job/[id].tsx', /Stack\.Screen[\s\S]+headerBackButtonDisplayMode: 'minimal'/],
      ['src/components/app-tabs.web.tsx', /accessibilityRole="tab"[\s\S]+selected[\s\S]+minHeight: 44[\s\S]+flex: 1[\s\S]+minWidth: 0/],
      ['src/components/map/job-map.web.tsx', /accessibilityRole="button"[\s\S]+accessibilityState=\{\{ selected:[\s\S]+minHeight: 44[\s\S]+minWidth: 44/],
    ] as const;
    for (const [path, assertion] of controls) expect(read(path)).toMatch(assertion);
  });
});
