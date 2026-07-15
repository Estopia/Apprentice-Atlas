import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { validatedPendingTrackJobId } from '@/lib/application-flow';
import { createSessionFromUrl, getReadableAuthError, isSafeReturnPath, validatedPendingSaveJobId } from '@/lib/auth';
import { addPendingFavorite, getReadableFavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';

export default function AuthCallbackScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const incomingUrl = Linking.useURL();
  const params = useLocalSearchParams<{ returnTo?: string; pendingAction?: string; jobId?: string }>();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [completionUserId, setCompletionUserId] = useState<string | null>(null);
  const returnTo = isSafeReturnPath(params.returnTo) ? params.returnTo : '/atlas';
  const pendingTrackJobId = validatedPendingTrackJobId(params);
  const pendingSaveJobId = validatedPendingSaveJobId(params);

  const continueAfterSignIn = useCallback(async (expectedUserId: string) => {
    setError(null);
    if (pendingTrackJobId) {
      router.replace({ pathname: '/application/[jobId]', params: { jobId: pendingTrackJobId } } as never);
      return;
    }
    if (pendingSaveJobId) {
      const result = await addPendingFavorite(pendingSaveJobId, expectedUserId);
      if (result.error) {
        setError(getReadableFavoritesError(result.error, locale));
        return;
      }
    }
    router.replace(returnTo as never);
  }, [locale, pendingSaveJobId, pendingTrackJobId, returnTo, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let active = true;
    void (async () => {
      const url = incomingUrl ?? await Linking.getInitialURL();
      if (!url) {
        if (active) setError(t(locale, 'auth.callbackMissing'));
        return;
      }
      const result = await createSessionFromUrl(url);
      if (!active) return;
      if (result.error) {
        setError(getReadableAuthError(result.error, locale));
        return;
      }
      const authenticatedUserId = result.data?.user.id;
      if (!authenticatedUserId) {
        setError(t(locale, 'auth.callbackMissing'));
        return;
      }
      setCompletionUserId(authenticatedUserId);
      setSessionReady(true);
      await continueAfterSignIn(authenticatedUserId);
    })();
    return () => { active = false; };
  }, [continueAfterSignIn, incomingUrl, locale]); // The callback must be consumed exactly once.

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.icon}>
        <AppIcon
          name={{ ios: error ? 'exclamationmark' : 'checkmark', android: error ? 'error' : 'check', web: error ? 'error' : 'check' }}
          size={26}
          tintColor={error ? Palette.danger : Palette.blue}
        />
      </View>
      <Text style={styles.title}>{error ? t(locale, 'auth.callbackErrorTitle') : t(locale, 'auth.callbackTitle')}</Text>
      <Text style={styles.copy}>{error ?? t(locale, 'auth.callbackDescription')}</Text>
      {!error && <ActivityIndicator color={Palette.blue} size="small" />}
      {error && sessionReady && (
        <Pressable accessibilityRole="button" onPress={() => completionUserId && void continueAfterSignIn(completionUserId)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{t(locale, 'auth.tryAgain')}</Text>
        </Pressable>
      )}
      {error && !sessionReady && (
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{t(locale, 'auth.requestNewLink')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 28, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', gap: 14 },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  title: { color: Palette.blueDark, fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  copy: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  button: { minHeight: 50, borderRadius: 12, backgroundColor: Palette.blue, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: Palette.white, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.76 },
});
