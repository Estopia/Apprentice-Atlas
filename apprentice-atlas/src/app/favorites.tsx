import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { buildComparisonRows, listFavorites, optimisticFavoriteState, removeFavorite } from '@/lib/favorites';
import { useLocale, t } from '@/lib/i18n';
import type { FavoriteJob } from '@/types/jobs';

export default function FavoritesScreen() {
  const [locale] = useLocale(); const router = useRouter(); const auth = useAuth(); const [favorites, setFavorites] = useState<FavoriteJob[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (auth.loading || !auth.session) return;
    let mounted = true;
    void listFavorites().then((result) => { if (!mounted) return; setFavorites(result.data ?? []); setError(result.error?.message ?? null); setLoading(false); });
    return () => { mounted = false; };
  }, [auth.loading, auth.session]);
  const remove = async (favorite: FavoriteJob) => {
    const previous = favorites; setFavorites(optimisticFavoriteState(previous, favorite, 'remove')); setError(null);
    const result = await removeFavorite(favorite.jobId);
    if (result.error) { setFavorites(previous); setError(result.error.message); }
  };
  if (auth.loading || loading) return <State text={t(locale, 'saved.loading')} />;
  if (!auth.session) return <State text={t(locale, 'saved.description')} action={t(locale, 'saved.signIn')} onPress={() => router.push('/auth')} />;
  if (error && !favorites.length) return <State text={error || t(locale, 'saved.error')} action={t(locale, 'discovery.retry')} onPress={() => router.replace('/favorites')} />;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>{t(locale, 'saved.title')}</Text>{error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!favorites.length ? <State text={t(locale, 'saved.empty')} /> : <>{favorites.map((favorite) => <FavoriteCard key={favorite.id} favorite={favorite} onRemove={() => void remove(favorite)} onOpen={() => favorite.job && router.push(`/job/${favorite.job.id}`)} locale={locale} />)}{favorites.length > 1 && <Comparison favorites={favorites} locale={locale} />}</>}</ScrollView></SafeAreaView>;
}

function FavoriteCard({ favorite, onRemove, onOpen, locale }: { favorite: FavoriteJob; onRemove: () => void; onOpen: () => void; locale: 'de' | 'en' }) {
  const job = favorite.job; return <View style={styles.card}><Pressable accessibilityRole="button" accessibilityLabel={job?.title ?? t(locale, 'saved.unavailable')} disabled={!job} onPress={onOpen}><Text style={styles.cardTitle}>{job?.title ?? t(locale, 'saved.unavailable')}</Text><Text style={styles.company}>{job?.company ?? '—'}</Text><Text style={styles.meta}>{job ? `${job.city}, ${job.country} · ${job.jobType}` : t(locale, 'saved.unavailable')}</Text><Text style={styles.date}>{job?.sourceName ?? '—'} · {new Date(job?.lastSeenAt || favorite.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'saved.remove')} onPress={onRemove} style={styles.remove}><Text style={styles.removeText}>{t(locale, 'saved.remove')}</Text></Pressable></View>;
}

function Comparison({ favorites, locale }: { favorites: FavoriteJob[]; locale: 'de' | 'en' }) { return <View style={styles.compare}><Text style={styles.heading}>{t(locale, 'saved.compare')}</Text>{buildComparisonRows(favorites).map((row) => <View key={row.label} style={styles.compareRow}><Text style={styles.compareLabel}>{row.label}</Text>{row.values.map((value, index) => <Text key={`${row.label}-${index}`} style={styles.compareValue}>{value}</Text>)}</View>)}</View>; }
function State({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) { return <View style={styles.state}><Text accessibilityRole="alert" style={styles.copy}>{text}</Text>{action && onPress && <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={styles.action}><Text style={styles.actionText}>{action}</Text></Pressable>}</View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f5f0' }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 100 }, title: { color: '#173b35', fontSize: 30, fontWeight: '800', marginBottom: 16 }, card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e6e1da' }, cardTitle: { color: '#173b35', fontSize: 18, fontWeight: '800' }, company: { color: '#53645f', fontWeight: '700', marginTop: 5 }, meta: { color: '#53645f', marginTop: 5 }, date: { color: '#71827b', marginTop: 8, fontSize: 12 }, remove: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8 }, removeText: { color: '#d95d39', fontWeight: '800' }, compare: { backgroundColor: '#e9f1ed', borderRadius: 16, padding: 16, marginTop: 12 }, heading: { color: '#173b35', fontSize: 20, fontWeight: '800', marginBottom: 10 }, compareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#d6e2db', paddingVertical: 9 }, compareLabel: { width: 80, color: '#53645f', fontWeight: '800' }, compareValue: { flex: 1, minWidth: 110, color: '#173b35' }, state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, copy: { color: '#53645f', textAlign: 'center' }, action: { backgroundColor: '#d95d39', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 }, actionText: { color: '#fff', fontWeight: '800' }, error: { color: '#b33e2e', marginBottom: 10 } });
