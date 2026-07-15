import { DefaultTheme, router, Stack, ThemeProvider, useGlobalSearchParams, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Palette } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';
import { hydrateLocale, t, useLocale } from '@/lib/i18n';
import { registerLocalNotificationHandling } from '@/lib/deadline-reminders';
import { getOnboardingGateParams } from '@/lib/onboarding-destination';
import { loadPreferences } from '@/lib/preferences';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const { jobId, pendingAction, returnTo } = useGlobalSearchParams<{
    jobId?: string;
    pendingAction?: string;
    returnTo?: string;
  }>();
  const [locale] = useLocale();
  const { preferences, isHydrated: preferencesHydrated } = usePreferences();
  const [localeHydrated, setLocaleHydrated] = useState(false);

  useEffect(() => {
    void Promise.all([loadPreferences(), hydrateLocale()]).then(() => setLocaleHydrated(true));
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
    if (!preferencesHydrated || !localeHydrated) return;
    if (!preferences.onboardingComplete && pathname !== '/onboarding') {
      router.replace({
        pathname: '/onboarding',
        params: getOnboardingGateParams(pathname, { jobId, pendingAction, returnTo }),
      });
    }
    void SplashScreen.hideAsync();
  }, [jobId, localeHydrated, pathname, pendingAction, preferences.onboardingComplete, preferencesHydrated, returnTo]);

  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Palette.blue, background: Palette.background, card: Palette.background, text: Palette.text, border: Palette.border } }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.background } }}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: true, headerShadowVisible: false }} />
        <Stack.Screen name="auth-callback" options={{ gestureEnabled: false }} />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="settings" options={{ headerShown: true, headerShadowVisible: false }} />
        <Stack.Screen name="legal/[document]" options={{ headerShown: true, headerShadowVisible: false }} />
        <Stack.Screen name="application/[jobId]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.86, 1], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false, title: t(locale, 'application.sheetTitle'), contentStyle: { backgroundColor: Palette.surface } }} />
        <Stack.Screen name="filters" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.85, 1], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false }} />
        <Stack.Screen name="location" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 0.85], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false }} />
      </Stack>
    </ThemeProvider>
  );
}
