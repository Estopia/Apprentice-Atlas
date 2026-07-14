import { DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { Palette } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';
import { hydrateLocale, t, useLocale } from '@/lib/i18n';
import { loadPreferences } from '@/lib/preferences';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const [locale] = useLocale();
  const { preferences, isHydrated: preferencesHydrated } = usePreferences();
  const [localeHydrated, setLocaleHydrated] = useState(false);

  useEffect(() => {
    void Promise.all([loadPreferences(), hydrateLocale()]).then(() => setLocaleHydrated(true));
  }, []);

  useEffect(() => {
    if (!preferencesHydrated || !localeHydrated) return;
    if (!preferences.onboardingComplete && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
    void SplashScreen.hideAsync();
  }, [localeHydrated, pathname, preferences.onboardingComplete, preferencesHydrated]);

  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Palette.blue, background: Palette.background, card: Palette.background, text: Palette.text, border: Palette.border } }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.background } }}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: true, headerShadowVisible: false }} />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="application/[jobId]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.86, 1], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false, title: t(locale, 'application.sheetTitle'), contentStyle: { backgroundColor: Palette.surface } }} />
        <Stack.Screen name="filters" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.85, 1], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false }} />
        <Stack.Screen name="location" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 0.85], sheetGrabberVisible: true, headerShown: true, headerShadowVisible: false }} />
      </Stack>
    </ThemeProvider>
  );
}
