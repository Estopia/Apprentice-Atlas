import { describe, expect, it, vi } from 'vitest';

vi.mock('@/global.css', () => ({}));
vi.mock('react-native', () => ({
  Platform: {
    select: <T,>(values: { default?: T; ios?: T; web?: T }) => values.default ?? values.ios ?? values.web,
  },
}));

import { AppAppearance, Colors } from '../src/constants/theme';
import { useTheme } from '../src/hooks/use-theme';

describe('light-only app theme', () => {
  it('publishes only the honest supported appearance', () => {
    expect(AppAppearance).toBe('light');
    expect(Object.keys(Colors)).toEqual(['light']);
  });

  it('returns the same light theme object for every caller', () => {
    expect(useTheme()).toBe(Colors.light);
  });
});
