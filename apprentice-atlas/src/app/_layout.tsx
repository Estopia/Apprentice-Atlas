import { DefaultTheme, router, Stack, ThemeProvider, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { LaunchGate } from '@/components/launch/launch-gate';
import { Palette } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';
import { t, useLocale } from '@/lib/i18n';
import { registerLocalNotificationHandling } from '@/lib/deadline-reminders';
import { getOnboardingGateParams } from '@/lib/onboarding-destination';
import { loadPreferences } from '@/lib/preferences';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const pathname = usePathname();
  const { jobId, pendingAction, returnTo } = useGlobalSearchParams<{
    jobId?: string;
    pendingAction?: string;
    returnTo?: string;
  }>();
  const [locale] = useLocale();
  const { preferences, isHydrated: preferencesHydrated } = usePreferences();

  useEffect(() => {
    void loadPreferences();
  }, []);

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => void) | undefined;

    void registerLocalNotificationHandling((route) => router.push(route))
      .then((remove) => {
        if (disposed) remove();
        else removeListener = remove;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) return;
    if (!preferences.onboardingComplete && pathname !== '/onboarding') {
      router.replace({
        pathname: '/onboarding',
        params: getOnboardingGateParams(pathname, { jobId, pendingAction, returnTo }),
      });
    }
  }, [jobId, pathname, pendingAction, preferences.onboardingComplete, preferencesHydrated, returnTo]);

  const bootstrapReady = preferencesHydrated;

  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Palette.blue, background: Palette.background, card: Palette.background, text: Palette.text, border: Palette.border } }}>
      <LaunchGate bootstrapReady={bootstrapReady} onboardingComplete={preferences.onboardingComplete} pathname={pathname}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.background } }}>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: true, headerShadowVisible: false }} />
          <Stack.Screen name="auth-callback" options={{ gestureEnabled: false }} />
          <Stack.Screen name="job/[id]" />
          <Stack.Screen name="share/[jobId]" options={{ headerShown: true, headerShadowVisible: false }} />
          <Stack.Screen name="prepare/[jobId]" options={{ headerShown: true, headerShadowVisible: false }} />
          <Stack.Screen name="settings" options={{ headerShown: true, headerShadowVisible: false }} />
          <Stack.Screen name="legal/[document]" options={{ headerShown: true, headerShadowVisible: false }} />
          <Stack.Screen name="application/[jobId]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.86, 1], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false, title: t(locale, 'application.sheetTitle'), contentStyle: { backgroundColor: Palette.surface } }} />
          <Stack.Screen name="filters" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.85, 1], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false }} />
          <Stack.Screen name="location" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 0.85], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false }} />
        </Stack>
      </LaunchGate>
    </ThemeProvider>
  );
}
