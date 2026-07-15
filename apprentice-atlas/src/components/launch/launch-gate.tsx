import * as SplashScreen from 'expo-splash-screen';
import { Image } from 'expo-image';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { shouldRevealLaunchContent } from '@/lib/launch-readiness';

const MINIMUM_DISPLAY_MS = 850;
const EXIT_DURATION_MS = 360;

type LaunchContextValue = {
  discoveryReady: boolean;
  markDiscoveryReady: () => void;
};

const LaunchContext = createContext<LaunchContextValue | null>(null);

export function LaunchGate({
  bootstrapReady,
  children,
  onboardingComplete,
  pathname,
}: {
  bootstrapReady: boolean;
  children: ReactNode;
  onboardingComplete: boolean;
  pathname: string;
}) {
  const nativeSplashHidden = useRef(false);
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const [minimumDisplayElapsed, setMinimumDisplayElapsed] = useState(false);
  const [exitStarted, setExitStarted] = useState(false);
  const [visible, setVisible] = useState(true);
  const reveal = shouldRevealLaunchContent({ bootstrapReady, discoveryReady, onboardingComplete, pathname });

  const markDiscoveryReady = useCallback(() => setDiscoveryReady(true), []);
  const context = useMemo(() => ({ discoveryReady, markDiscoveryReady }), [discoveryReady, markDiscoveryReady]);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    const minimumTimer = setTimeout(() => setMinimumDisplayElapsed(true), MINIMUM_DISPLAY_MS);
    return () => clearTimeout(minimumTimer);
  }, []);

  useEffect(() => {
    if (!reveal || !minimumDisplayElapsed || exitStarted) return;
    const exitTimer = setTimeout(() => setExitStarted(true), 0);
    return () => clearTimeout(exitTimer);
  }, [exitStarted, minimumDisplayElapsed, reveal]);

  useEffect(() => {
    if (!exitStarted) return;
    const removeTimer = setTimeout(() => setVisible(false), EXIT_DURATION_MS + 40);
    return () => clearTimeout(removeTimer);
  }, [exitStarted]);

  return (
    <LaunchContext.Provider value={context}>
      <View onLayout={hideNativeSplash} style={styles.root}>
        {children}
        {visible && <LaunchCover exiting={exitStarted} />}
      </View>
    </LaunchContext.Provider>
  );
}

export function useLaunchReadiness() {
  const value = useContext(LaunchContext);
  if (!value) throw new Error('useLaunchReadiness must be used inside LaunchGate');
  return value;
}

function LaunchCover({ exiting }: { exiting: boolean }) {
  const [locale] = useLocale();
  const reduceMotion = useReducedMotion();
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  const orbit = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: reduceMotion ? 0 : 620,
      easing: Easing.out(Easing.quad),
    });
    if (!reduceMotion) {
      orbit.value = withRepeat(withTiming(1, { duration: 1650, easing: Easing.linear }), -1, false);
    }
    return () => cancelAnimation(orbit);
  }, [entrance, orbit, reduceMotion]);

  useEffect(() => {
    if (!exiting) return;
    exit.value = withTiming(1, {
      duration: reduceMotion ? 0 : EXIT_DURATION_MS,
      easing: Easing.inOut(Easing.quad),
    });
  }, [exit, exiting, reduceMotion]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: interpolate(exit.value, [0, 1], [1, 1.015]) }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(entrance.value, [0, 1], [0.96, 1]) }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: interpolate(entrance.value, [0, 1], [10, 0]) }],
  }));
  const orbitStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ rotate: `${orbit.value * 360}deg` }],
  }));

  return (
    <Animated.View
      accessibilityLabel={t(locale, 'launch.preparing')}
      accessibilityRole="progressbar"
      style={[styles.cover, coverStyle]}>
      <View pointerEvents="none" style={[styles.contour, styles.contourTop]} />
      <View pointerEvents="none" style={[styles.contour, styles.contourBottom]} />

      <View style={styles.identity}>
        <View style={styles.logoStage}>
          <Animated.View style={[styles.orbit, orbitStyle]}>
            <View style={styles.orbitDot} />
          </Animated.View>
          <Animated.View style={[styles.logoShell, logoStyle]}>
            <Image
              accessibilityIgnoresInvertColors
              contentFit="contain"
              source={require('../../../assets/images/launch-logo.png')}
              style={styles.logo}
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Text style={styles.wordmark}>Apprentice Atlas</Text>
          <Text style={styles.tagline}>{t(locale, 'launch.tagline')}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.preparing, copyStyle]}>
        <View style={styles.routeLine}>
          <View style={styles.routeDot} />
          <View style={styles.routeSegment} />
          <View style={[styles.routeDot, styles.routeDotMuted]} />
          <View style={styles.routeSegment} />
          <View style={[styles.routeDot, styles.routeDotMuted]} />
        </View>
        <Text style={styles.preparingText}>{t(locale, 'launch.preparing')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  cover: { position: 'absolute', inset: 0, zIndex: 1000, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.background },
  contour: { position: 'absolute', width: 430, height: 430, borderRadius: 215, borderWidth: 1, borderColor: '#DCE8FF' },
  contourTop: { top: -286, right: -182 },
  contourBottom: { bottom: -312, left: -150 },
  identity: { width: '100%', height: 172, alignItems: 'center', justifyContent: 'center' },
  logoStage: { width: 172, height: 172, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#C9DAFF' },
  orbitDot: { position: 'absolute', top: -4, left: 72, width: 9, height: 9, borderRadius: 5, backgroundColor: Palette.blue },
  logoShell: { width: 116, height: 116 },
  logo: { width: '100%', height: '100%' },
  copy: { position: 'absolute', top: 184, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 28 },
  wordmark: { color: Palette.blueDark, fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  tagline: { maxWidth: 280, marginTop: 8, color: Palette.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  preparing: { position: 'absolute', bottom: 58, alignItems: 'center', gap: 12 },
  routeLine: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.blue },
  routeDotMuted: { backgroundColor: '#B9CCF5' },
  routeSegment: { width: 24, height: 1, backgroundColor: '#B9CCF5' },
  preparingText: { color: Palette.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.35 },
});
