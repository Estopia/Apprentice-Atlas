import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('adaptive home navigation', () => {
  it('exposes Home, Map, Saved, and Atlas as the four native tabs', () => {
    const nativeTabs = read('src/components/app-tabs.tsx');
    const webTabs = read('src/components/app-tabs.web.tsx');

    for (const source of [nativeTabs, webTabs]) {
      expect(source).toContain('name="index"');
      expect(source).toContain('name="map"');
      expect(source).toContain('name="favorites"');
      expect(source).toContain('name="atlas"');
    }
  });

  it('keeps discovery in the map tab and accepts list handoff from search', () => {
    const map = read('src/app/(tabs)/map.tsx');
    const search = read('src/app/search.tsx');

    expect(map).toContain("useLocalSearchParams<{ view?: string }>");
    expect(map).toMatch(/view === 'list'/);
    expect(search).toContain("pathname: '/map'");
    expect(search).toContain("view: 'list'");
    expect(search).toContain('updateDiscoveryFilters');
  });

  it('keeps the old explore route as a map compatibility redirect', () => {
    expect(read('src/app/(tabs)/explore.tsx')).toContain('Redirect href="/map"');
  });
});
