import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthForm } from '@/components/auth/auth-form';
import { Palette } from '@/constants/theme';
import { validatedPendingTrackJobId } from '@/lib/application-flow';
import { getReadableAuthError, isSafeReturnPath, signInForDemo, validatedPendingSaveJobId } from '@/lib/auth';
import { getAuthNavigationPresentation, registerDemoUnlockTap, type DemoUnlockTapState } from '@/lib/auth-presentation';
import { addPendingFavorite, getReadableFavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';

export default function AuthScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; pendingAction?: string; jobId?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const demoTapState = useRef<DemoUnlockTapState>({ count: 0, lastTapAt: 0 });
  const navigationPresentation = getAuthNavigationPresentation();
  const returnTo = isSafeReturnPath(params.returnTo) ? params.returnTo : '/favorites';
  const pendingTrackJobId = validatedPendingTrackJobId(params);
  const pendingSaveJobId = validatedPendingSaveJobId(params);
  const continuationAction = pendingTrackJobId ? 'track' : pendingSaveJobId ? 'save' : undefined;
  const continuationJobId = pendingTrackJobId ?? pendingSaveJobId ?? undefined;
  const redirectTo = Linking.createURL('auth-callback', {
    queryParams: {
      returnTo,
      ...(continuationAction ? { pendingAction: continuationAction } : {}),
      ...(continuationJobId ? { jobId: continuationJobId } : {}),
    },
  });

  const complete = async (completionUserId: string) => {
    setError(null);
    if (pendingTrackJobId) {
      router.replace({ pathname: '/application/[jobId]', params: { jobId: pendingTrackJobId } } as never);
      return;
    }
    if (pendingSaveJobId) {
      const result = await addPendingFavorite(pendingSaveJobId, completionUserId);
      if (result.error) { setError(getReadableFavoritesError(result.error, locale)); return; }
    }
    router.replace(returnTo);
  };

  const handleDemoTap = async () => {
    if (demoBusy) return;
    const next = registerDemoUnlockTap(demoTapState.current, Date.now());
    demoTapState.current = next.state;
    if (!next.unlocked) return;

    setDemoBusy(true);
    setError(null);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      const result = await signInForDemo();
      if (result.error) {
        setError(getReadableAuthError(result.error, locale));
        return;
      }
      const userId = result.data?.user.id;
      if (!userId) {
        setError(t(locale, 'auth.demoError'));
        return;
      }
      await complete(userId);
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Pressable accessible={false} disabled={demoBusy} onPress={() => void handleDemoTap()}>
              <Text accessibilityRole="header" style={styles.title}>{t(locale, 'auth.title')}</Text>
            </Pressable>
            <Text style={styles.copy}>{t(locale, 'auth.description')}</Text>
            {demoBusy && (
              <View accessible accessibilityLiveRegion="assertive" accessibilityRole="progressbar" style={styles.demoStatus}>
                <ActivityIndicator color={Palette.blue} size="small" />
                <Text style={styles.demoStatusText}>{t(locale, 'auth.demoOpening')}</Text>
              </View>
            )}
          </View>
          <View style={styles.formGroup}>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <View pointerEvents={demoBusy ? 'none' : 'auto'} style={demoBusy && styles.formDisabled}>
              <AuthForm onSuccess={complete} redirectTo={redirectTo} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Stack.Screen options={{
        title: t(locale, 'auth.account'),
        ...navigationPresentation.headerOptions,
        headerStyle: { backgroundColor: Palette.white },
        headerTintColor: Palette.text,
      }} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { flexGrow: 1, width: '100%', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 },
  intro: { gap: 8, marginBottom: 28 },
  title: { color: Palette.text, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.4 },
  copy: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22 },
  demoStatus: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  demoStatusText: { color: Palette.blue, fontSize: 14, fontWeight: '700' },
  formGroup: { width: '100%' },
  formDisabled: { opacity: 0.55 },
  error: { color: Palette.danger, fontSize: 14, lineHeight: 20, marginBottom: 12, fontWeight: '600' },
});
