import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthForm } from '@/components/auth/auth-form';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { validatedPendingTrackJobId } from '@/lib/application-flow';
import { isSafeReturnPath } from '@/lib/auth';
import { addFavorite, getReadableFavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';

export default function AuthScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; pendingAction?: string; jobId?: string }>();
  const [error, setError] = useState<string | null>(null);
  const returnTo = isSafeReturnPath(params.returnTo) ? params.returnTo : '/favorites';
  const pendingTrackJobId = validatedPendingTrackJobId(params);

  const complete = async () => {
    setError(null);
    if (pendingTrackJobId) {
      router.replace({ pathname: '/application/[jobId]', params: { jobId: pendingTrackJobId } } as never);
      return;
    }
    if (params.pendingAction === 'save' && params.jobId && isSafeReturnPath(`/job/${params.jobId}`)) {
      const result = await addFavorite(params.jobId);
      if (result.error) { setError(getReadableFavoritesError(result.error, locale)); return; }
    }
    router.replace(returnTo);
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        {process.env.EXPO_OS !== 'ios' && <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.close')} onPress={() => router.back()} style={styles.close}><AppIcon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={19} tintColor={Palette.text} /></Pressable>}
        <View style={styles.intro}>
          <Text style={styles.title}>{t(locale, 'auth.title')}</Text>
          <Text style={styles.copy}>{t(locale, 'auth.description')}</Text>
        </View>
        <View style={styles.formGroup}>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <AuthForm onSuccess={() => void complete()} />
        </View>
      </ScrollView>
      <Stack.Screen options={{ title: t(locale, 'auth.account'), headerShown: true, headerShadowVisible: false }} />
      {process.env.EXPO_OS === 'ios' && <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} /></Stack.Toolbar>}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  intro: { gap: 8, marginBottom: 24 },
  title: { color: Palette.text, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.4 },
  copy: { color: Palette.textSecondary, lineHeight: 21, maxWidth: 420 },
  formGroup: { backgroundColor: Palette.white, borderRadius: 16, borderCurve: 'continuous', padding: 16 },
  error: { color: Palette.danger, marginBottom: 12, fontWeight: '600' },
});
