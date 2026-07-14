import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { getReadableAuthError, type AuthError } from '@/lib/auth';
import { buildComparisonRows, getReadableFavoritesError, invokeSignOut, isFavoritesLoading, listFavorites, optimisticFavoriteState, removeFavorite, rollbackFavoriteState, type FavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';
import type { FavoriteJob } from '@/types/jobs';

export default function FavoritesScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const auth = useAuth();
  const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);
  const [error, setError] = useState<FavoritesError | null>(null);
  const [signOutError, setSignOutError] = useState<AuthError | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const userId = auth.session?.user.id ?? null;
  const loading = isFavoritesLoading(auth.loading, userId, loadedForUserId);

  useEffect(() => {
    if (auth.loading || !auth.session) return;
    let mounted = true;
    void listFavorites().then((result) => { if (!mounted) return; setFavorites(result.data ?? []); setError(result.error); setLoadedForUserId(auth.session?.user.id ?? null); });
    return () => { mounted = false; };
  }, [auth.loading, auth.session]);

  const remove = async (favorite: FavoriteJob) => {
    const previous = favorites;
    setFavorites(optimisticFavoriteState(previous, favorite, 'remove')); setError(null);
    const result = await removeFavorite(favorite.jobId);
    if (result.error) { setFavorites(rollbackFavoriteState(previous)); setError(result.error); }
  };

  const handleSignOut = async () => {
    setSignOutError(null); setSignOutBusy(true);
    const result = await invokeSignOut(auth.signOut);
    if (result.error) setSignOutError(result.error as AuthError);
    setSignOutBusy(false);
  };

  if (loading) return <State text={t(locale, 'saved.loading')} />;
  if (!auth.session) return <State text={t(locale, 'saved.description')} action={t(locale, 'saved.signIn')} onPress={() => router.push('/auth')} />;
  const mappedError = error ? getReadableFavoritesError(error, locale, 'save') : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>YOUR ATLAS</Text><Text style={styles.title}>{t(locale, 'saved.title')}</Text></View>
          <View style={styles.savedCount}><AppIcon name={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }} size={18} tintColor={Palette.blue} /><Text style={styles.savedCountText}>{favorites.length}</Text></View>
        </View>
        <View style={styles.account}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(auth.user?.email ?? 'A').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.accountCopy}><Text style={styles.accountLabel}>{t(locale, 'saved.account')}</Text><Text style={styles.accountEmail} numberOfLines={1}>{auth.user?.email ?? ''}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'auth.signOut')} accessibilityState={{ disabled: signOutBusy }} disabled={signOutBusy} onPress={() => void handleSignOut()} style={styles.signOut}><Text style={styles.signOutText}>{signOutBusy ? t(locale, 'auth.signingOut') : t(locale, 'auth.signOut')}</Text></Pressable>
        </View>
        {signOutError && <Text accessibilityRole="alert" style={styles.error}>{getReadableAuthError(signOutError, locale)}</Text>}
        {mappedError && <Text accessibilityRole="alert" style={styles.error}>{mappedError}</Text>}
        {!favorites.length && error ? <State text={mappedError ?? t(locale, 'saved.errorLoad')} action={t(locale, 'discovery.retry')} onPress={() => router.replace('/favorites')} /> : !favorites.length ? <State text={t(locale, 'saved.empty')} /> : <View style={styles.cards}>{favorites.map((favorite) => <FavoriteCard key={favorite.id} favorite={favorite} onRemove={() => void remove(favorite)} onOpen={() => favorite.job && router.push(`/job/${favorite.job.id}`)} locale={locale} />)}</View>}
        {favorites.length > 1 && <Comparison favorites={favorites} locale={locale} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function FavoriteCard({ favorite, onRemove, onOpen, locale }: { favorite: FavoriteJob; onRemove: () => void; onOpen: () => void; locale: 'de' | 'en' }) {
  const job = favorite.job;
  const archived = t(locale, 'saved.archived');
  return (
    <View style={[styles.card, Shadows.subtle]}>
      <Pressable accessibilityRole="button" accessibilityLabel={job?.title ?? t(locale, 'saved.unavailable')} accessibilityState={{ disabled: !job }} disabled={!job} onPress={onOpen} style={styles.cardOpen}>
        <View style={styles.cardIcon}><AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={21} tintColor={Palette.blue} /></View>
        <View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={2}>{job?.title ?? t(locale, 'saved.unavailable')}</Text><Text style={styles.company} numberOfLines={1}>{job?.company ?? archived}</Text><View style={styles.metaRow}><AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={14} tintColor={Palette.textSecondary} /><Text style={styles.meta} numberOfLines={1}>{job ? `${job.city}, ${job.country}` : archived}</Text></View><Text style={styles.date}>{job?.sourceName ?? archived} · {new Date(job?.lastSeenAt || favorite.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'saved.remove')} onPress={onRemove} style={styles.remove}><AppIcon name={{ ios: 'bookmark.slash', android: 'bookmark_remove', web: 'bookmark_remove' }} size={18} tintColor={Palette.coral} /></Pressable>
    </View>
  );
}

function Comparison({ favorites, locale }: { favorites: FavoriteJob[]; locale: 'de' | 'en' }) {
  return <View style={styles.compare}><View style={styles.compareHeading}><AppIcon name={{ ios: 'square.split.2x1', android: 'compare', web: 'compare' }} size={20} tintColor={Palette.blue} /><Text style={styles.heading}>{t(locale, 'saved.compare')}</Text></View>{buildComparisonRows(favorites, locale).map((row) => <View key={row.label} style={styles.compareRow}><Text style={styles.compareLabel}>{row.label}</Text><View style={styles.compareValues}>{row.values.map((value, index) => <Text key={`${row.label}-${index}`} style={styles.compareValue}>{value}</Text>)}</View></View>)}</View>;
}

function State({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}><View style={styles.stateIcon}><AppIcon name={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={28} tintColor={Palette.blue} /></View><Text accessibilityRole="alert" style={styles.stateCopy}>{text}</Text>{action && onPress && <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={styles.action}><Text style={styles.actionText}>{action}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 18 },
  eyebrow: { color: Palette.blue, fontSize: 11, letterSpacing: 1.4, fontWeight: '900' },
  title: { color: Palette.blueDark, fontSize: 32, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  savedCount: { height: 44, minWidth: 58, paddingHorizontal: 13, borderRadius: 22, backgroundColor: Palette.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  savedCountText: { color: Palette.blue, fontWeight: '900' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: Palette.surface, borderRadius: Radius.medium, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: Palette.border },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Palette.white, fontSize: 16, fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountLabel: { color: Palette.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  accountEmail: { color: Palette.blueDark, fontWeight: '800', marginTop: 3 },
  signOut: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' },
  signOutText: { color: Palette.blue, fontWeight: '900', fontSize: 12 },
  cards: { gap: 10 },
  card: { backgroundColor: Palette.white, borderRadius: Radius.large, borderWidth: 1, borderColor: Palette.border, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardOpen: { flex: 1, minHeight: 82, flexDirection: 'row', gap: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: Palette.blueDark, fontSize: 17, lineHeight: 21, fontWeight: '900' },
  company: { color: Palette.text, fontWeight: '700', marginTop: 4, fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 6 },
  meta: { flex: 1, color: Palette.textSecondary, fontSize: 12 },
  date: { color: Palette.textSecondary, marginTop: 7, fontSize: 10 },
  remove: { width: 44, height: 44, minHeight: 44, minWidth: 44, borderRadius: 22, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center' },
  compare: { backgroundColor: Palette.surface, borderRadius: Radius.large, padding: 17, marginTop: 22, borderWidth: 1, borderColor: Palette.border },
  compareHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  heading: { color: Palette.blueDark, fontSize: 20, fontWeight: '900' },
  compareRow: { borderTopWidth: 1, borderTopColor: Palette.border, paddingVertical: 12 },
  compareLabel: { color: Palette.blue, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  compareValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compareValue: { flex: 1, minWidth: 120, color: Palette.text, backgroundColor: Palette.white, borderRadius: 12, padding: 9, fontSize: 12 },
  state: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  stateIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stateCopy: { color: Palette.textSecondary, textAlign: 'center', maxWidth: 360, lineHeight: 21 },
  action: { minHeight: 48, backgroundColor: Palette.blue, borderRadius: 16, paddingHorizontal: 18, justifyContent: 'center' },
  actionText: { color: Palette.white, fontWeight: '900' },
  error: { color: Palette.danger, marginBottom: 10, fontWeight: '700' },
});
