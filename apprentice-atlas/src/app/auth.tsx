import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthForm } from '@/components/auth/auth-form';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { isSafeReturnPath } from '@/lib/auth';
import { addFavorite, getReadableFavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';

export default function AuthScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; pendingAction?: string; jobId?: string }>();
  const [error, setError] = useState<string | null>(null);
  const returnTo = isSafeReturnPath(params.returnTo) ? params.returnTo : '/favorites';

  const complete = async () => {
    setError(null);
    if (params.pendingAction === 'save' && params.jobId && isSafeReturnPath(`/job/${params.jobId}`)) {
      const result = await addFavorite(params.jobId);
      if (result.error) { setError(getReadableFavoritesError(result.error, locale)); return; }
    }
    router.replace(returnTo);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.back')} onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={20} tintColor={Palette.blueDark} />
        </Pressable>
        <View style={styles.intro}>
          <View style={styles.logo}><AppIcon name={{ ios: 'person.crop.circle.badge.checkmark', android: 'account_circle', web: 'account_circle' }} size={34} tintColor={Palette.white} /></View>
          <Text style={styles.eyebrow}>APPRENTICE ATLAS</Text>
          <Text style={styles.title}>{t(locale, 'auth.title')}</Text>
          <Text style={styles.copy}>{t(locale, 'auth.description')}</Text>
        </View>
        <View style={[styles.card, Shadows.floating]}>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <AuthForm onSuccess={() => void complete()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.surface },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingBottom: 80, justifyContent: 'center' },
  backButton: { position: 'absolute', top: 20, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  intro: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  logo: { width: 66, height: 66, borderRadius: 22, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { color: Palette.blue, fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  title: { color: Palette.blueDark, fontSize: 32, lineHeight: 38, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  copy: { color: Palette.textSecondary, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginTop: 9 },
  card: { backgroundColor: Palette.white, borderRadius: Radius.large, padding: 20, borderWidth: 1, borderColor: Palette.border },
  error: { color: Palette.danger, marginBottom: 12, fontWeight: '700' },
});
