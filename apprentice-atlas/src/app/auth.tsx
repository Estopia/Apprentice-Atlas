import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthForm } from '@/components/auth/auth-form';
import { Palette } from '@/constants/theme';
import { validatedPendingTrackJobId } from '@/lib/application-flow';
import { isSafeReturnPath, validatedPendingSaveJobId } from '@/lib/auth';
import { addFavorite, getReadableFavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';

export default function AuthScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; pendingAction?: string; jobId?: string }>();
  const [error, setError] = useState<string | null>(null);
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

  const complete = async () => {
    setError(null);
    if (pendingTrackJobId) {
      router.replace({ pathname: '/application/[jobId]', params: { jobId: pendingTrackJobId } } as never);
      return;
    }
    if (pendingSaveJobId) {
      const result = await addFavorite(pendingSaveJobId);
      if (result.error) { setError(getReadableFavoritesError(result.error, locale)); return; }
    }
    router.replace(returnTo);
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
            <Text style={styles.title}>{t(locale, 'auth.title')}</Text>
            <Text style={styles.copy}>{t(locale, 'auth.description')}</Text>
          </View>
          <View style={styles.formGroup}>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <AuthForm onSuccess={() => void complete()} redirectTo={redirectTo} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Stack.Screen options={{
        title: t(locale, 'auth.account'),
        headerShown: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
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
  formGroup: { width: '100%' },
  error: { color: Palette.danger, fontSize: 14, lineHeight: 20, marginBottom: 12, fontWeight: '600' },
});
