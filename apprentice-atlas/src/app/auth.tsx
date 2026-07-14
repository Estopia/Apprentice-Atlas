import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AuthForm } from '@/components/auth/auth-form';
import { addFavorite, getReadableFavoritesError } from '@/lib/favorites';
import { isSafeReturnPath } from '@/lib/auth';
import { useLocale, t } from '@/lib/i18n';

export default function AuthScreen() {
  const [locale] = useLocale(); const router = useRouter(); const params = useLocalSearchParams<{ returnTo?: string; pendingAction?: string; jobId?: string }>(); const [error, setError] = useState<string | null>(null);
  const returnTo = isSafeReturnPath(params.returnTo) ? params.returnTo : '/favorites';
  const complete = async () => {
    setError(null);
    if (params.pendingAction === 'save' && params.jobId && isSafeReturnPath(`/job/${params.jobId}`)) { const result = await addFavorite(params.jobId); if (result.error) { setError(getReadableFavoritesError(result.error, locale)); return; } }
    router.replace(returnTo);
  };
  return <SafeAreaView style={styles.safe}><View style={styles.content}><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.back')} onPress={() => router.back()}><Text style={styles.back}>‹ {t(locale, 'actions.back')}</Text></Pressable><Text style={styles.title}>{t(locale, 'auth.title')}</Text><Text style={styles.copy}>{t(locale, 'auth.description')}</Text>{error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<AuthForm onSuccess={() => void complete()} /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f5f0' }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24, gap: 10 }, back: { color: '#d95d39', fontWeight: '800', marginBottom: 22 }, title: { color: '#173b35', fontSize: 30, fontWeight: '800' }, copy: { color: '#53645f', marginBottom: 10 }, error: { color: '#b33e2e' } });
