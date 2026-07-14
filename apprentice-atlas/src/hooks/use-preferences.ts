import { useSyncExternalStore } from 'react';

import {
  completeOnboarding,
  getPreferencesSnapshot,
  savePreferences,
  subscribePreferences,
} from '@/lib/preferences';

export function usePreferences() {
  const snapshot = useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getPreferencesSnapshot,
  );

  return {
    ...snapshot,
    savePreferences,
    completeOnboarding,
  };
}
