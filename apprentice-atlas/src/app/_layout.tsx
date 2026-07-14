import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Palette } from '@/constants/theme';
import { hydrateLocale } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  useEffect(() => {
    void hydrateLocale();
    void SplashScreen.hideAsync();
  }, []);
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: Palette.blue, background: Palette.background, card: Palette.background, text: Palette.text, border: Palette.border } }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="job/[id]" />
      </Stack>
    </ThemeProvider>
  );
}
