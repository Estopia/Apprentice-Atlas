import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  blue: '#155EEF',
  bluePressed: '#004EEB',
  blueDark: '#081F4D',
  blueSoft: '#EAF1FF',
  background: '#FFFFFF',
  surface: '#F5F7FB',
  surfaceStrong: '#EDF2F8',
  text: '#0B1B3A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#22A06B',
  coral: '#FF6B57',
  lime: '#83C93C',
  danger: '#D92D20',
  white: '#FFFFFF',
} as const;

// Apprentice Atlas intentionally presents a single light appearance.
export const AppAppearance = 'light' as const;

export const Colors = {
  light: {
    text: Palette.text,
    background: Palette.background,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.blueSoft,
    textSecondary: Palette.textSecondary,
  },
  dark: {
    text: Palette.text,
    background: Palette.background,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.blueSoft,
    textSecondary: Palette.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 12,
  medium: 18,
  large: 24,
  pill: 999,
} as const;

export const Shadows = {
  floating: {
    boxShadow: '0 12px 32px rgba(8, 31, 77, 0.16)',
  },
  subtle: {
    boxShadow: '0 6px 18px rgba(8, 31, 77, 0.08)',
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 900;
