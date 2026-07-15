import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import LottieView from 'lottie-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { shouldRevealLaunchContent } from '@/lib/launch-readiness';

const EXIT_DURATION_MS = 360;
const ANIMATION_FAILSAFE_MS = 3600;

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
  const [animationComplete, setAnimationComplete] = useState(false);
  const [exitStarted, setExitStarted] = useState(false);
  const [visible, setVisible] = useState(true);
  const contentReady = shouldRevealLaunchContent({ bootstrapReady, discoveryReady, onboardingComplete, pathname });

  const markDiscoveryReady = useCallback(() => setDiscoveryReady(true), []);
  const markAnimationComplete = useCallback(() => setAnimationComplete(true), []);
  const context = useMemo(() => ({ discoveryReady, markDiscoveryReady }), [discoveryReady, markDiscoveryReady]);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    const failsafeTimer = setTimeout(markAnimationComplete, ANIMATION_FAILSAFE_MS);
    return () => clearTimeout(failsafeTimer);
  }, [markAnimationComplete]);

  useEffect(() => {
    if (!contentReady || !animationComplete || exitStarted) return;
    const exitTimer = setTimeout(() => setExitStarted(true), 0);
    return () => clearTimeout(exitTimer);
  }, [animationComplete, contentReady, exitStarted]);

  useEffect(() => {
    if (!exitStarted) return;
    const removeTimer = setTimeout(() => setVisible(false), EXIT_DURATION_MS + 40);
    return () => clearTimeout(removeTimer);
  }, [exitStarted]);

  return (
    <LaunchContext.Provider value={context}>
      <View onLayout={hideNativeSplash} style={styles.root}>
        <StatusBar animated style={visible ? 'light' : 'dark'} />
        {children}
        {visible && <LaunchCover exiting={exitStarted} onAnimationComplete={markAnimationComplete} />}
      </View>
    </LaunchContext.Provider>
  );
}

export function useLaunchReadiness() {
  const value = useContext(LaunchContext);
  if (!value) throw new Error('useLaunchReadiness must be used inside LaunchGate');
  return value;
}

function LaunchCover({ exiting, onAnimationComplete }: { exiting: boolean; onAnimationComplete: () => void }) {
  const [locale] = useLocale();
  const reduceMotion = useReducedMotion();
  const animationRef = useRef<LottieView>(null);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) onAnimationComplete();
  }, [onAnimationComplete, reduceMotion]);

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

  return (
    <Animated.View
      accessibilityLabel={t(locale, 'launch.preparing')}
      accessibilityRole="progressbar"
      accessibilityViewIsModal
      style={[styles.cover, coverStyle]}>
      <LottieView
        ref={animationRef}
        autoPlay={!reduceMotion}
        enableSafeModeAndroid
        loop={false}
        onAnimationFailure={onAnimationComplete}
        onAnimationFinish={(cancelled) => { if (!cancelled) onAnimationComplete(); }}
        onAnimationLoaded={() => { if (reduceMotion) animationRef.current?.play(89, 89); }}
        progress={reduceMotion ? 1 : undefined}
        renderMode="HARDWARE"
        resizeMode="contain"
        source={require('../../../assets/logo-loading.json')}
        speed={1.35}
        style={styles.logoAnimation}
        webStyle={styles.logoAnimationWeb}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.background },
  cover: { position: 'absolute', inset: 0, zIndex: 1000, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blue },
  logoAnimation: { width: 77, aspectRatio: 463 / 621 },
  logoAnimationWeb: { width: 77, height: 103.5 },
});
