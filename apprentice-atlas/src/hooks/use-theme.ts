import { AppAppearance, Colors } from '../constants/theme';

export function useTheme() {
  return Colors[AppAppearance];
}
