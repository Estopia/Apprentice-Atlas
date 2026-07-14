import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { getReadableAuthError, type AuthError } from '@/lib/auth';
import { buildComparisonRows, getReadableFavoritesError, invokeSignOut, isFavoritesLoading, listFavorites, optimisticFavoriteState, removeFavorite, rollbackFavoriteState, type FavoritesError } from '@/lib/favorites';
import { localizeCountry, localizeJobType, t, useLocale } from '@/lib/i18n';
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
  const currentFavorites = loadedForUserId === userId ? favorites : [];
  const currentError = loadedForUserId === userId ? error : null;

  useEffect(() => {
    if (auth.loading || !userId) return;
    let mounted = true;
    void listFavorites().then((result) => { if (!mounted) return; setFavorites(result.data ?? []); setError(result.error); setLoadedForUserId(userId); });
    return () => { mounted = false; };
  }, [auth.loading, userId]);

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
  const mappedError = currentError ? getReadableFavoritesError(currentError, locale, 'save') : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>{t(locale, 'saved.title')}</Text>
          <Text style={styles.savedCountText}>{currentFavorites.length}</Text>
        </View>
        <View style={styles.account}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(auth.user?.email ?? 'A').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.accountCopy}><Text style={styles.accountEmail} numberOfLines={1}>{auth.user?.email ?? ''}</Text><Text style={styles.accountLabel}>{t(locale, 'saved.account')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'auth.signOut')} accessibilityState={{ disabled: signOutBusy }} disabled={signOutBusy} onPress={() => void handleSignOut()} style={styles.signOut}><Text style={styles.signOutText}>{signOutBusy ? t(locale, 'auth.signingOut') : t(locale, 'auth.signOut')}</Text></Pressable>
        </View>
        {signOutError && <Text accessibilityRole="alert" style={styles.error}>{getReadableAuthError(signOutError, locale)}</Text>}
        {mappedError && <Text accessibilityRole="alert" style={styles.error}>{mappedError}</Text>}
        {!currentFavorites.length && currentError ? <State text={mappedError ?? t(locale, 'saved.errorLoad')} action={t(locale, 'discovery.retry')} onPress={() => router.replace('/favorites')} /> : !currentFavorites.length ? <State text={t(locale, 'saved.empty')} /> : <View style={styles.cards}>{currentFavorites.map((favorite) => <FavoriteCard key={favorite.id} favorite={favorite} onRemove={() => void remove(favorite)} onOpen={() => favorite.job && router.push(`/job/${favorite.job.id}`)} locale={locale} />)}</View>}
        {currentFavorites.length > 1 && <Comparison favorites={currentFavorites} locale={locale} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function FavoriteCard({ favorite, onRemove, onOpen, locale }: { favorite: FavoriteJob; onRemove: () => void; onOpen: () => void; locale: 'de' | 'en' }) {
  const job = favorite.job;
  const archived = t(locale, 'saved.archived');
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={job?.title ?? t(locale, 'saved.unavailable')} accessibilityState={{ disabled: !job }} disabled={!job} onPress={onOpen} style={styles.cardOpen}>
        <View style={styles.cardIcon}><Text style={styles.cardIconText}>{(job?.company ?? '?').slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={2}>{job?.title ?? t(locale, 'saved.unavailable')}</Text><Text style={styles.company} numberOfLines={1}>{job?.company ?? archived}</Text><View style={styles.metaRow}><AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={14} tintColor={Palette.textSecondary} /><Text style={styles.meta} numberOfLines={1}>{job ? `${job.city}, ${localizeCountry(locale, job.country)} · ${localizeJobType(locale, job.jobType)}` : archived}</Text></View><Text style={styles.date}>{job?.sourceName ?? archived} · {new Date(job?.lastSeenAt || favorite.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'saved.remove')} onPress={onRemove} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}><AppIcon name={{ ios: 'bookmark.slash', android: 'bookmark_remove', web: 'bookmark_remove' }} size={18} tintColor={Palette.blue} /></Pressable>
    </View>
  );
}

function Comparison({ favorites, locale }: { favorites: FavoriteJob[]; locale: 'de' | 'en' }) {
  return <View style={styles.compare}><View style={styles.compareHeading}><Text style={styles.heading}>{t(locale, 'saved.compare')}</Text><AppIcon name={{ ios: 'square.split.2x1', android: 'compare', web: 'compare' }} size={18} tintColor={Palette.textSecondary} /></View>{buildComparisonRows(favorites, locale).map((row) => <View key={row.label} style={styles.compareRow}><Text style={styles.compareLabel}>{row.label}</Text><View style={styles.compareValues}>{row.values.map((value, index) => <Text key={`${row.label}-${index}`} style={styles.compareValue}>{value}</Text>)}</View></View>)}</View>;
}

function State({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}><AppIcon name={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={38} tintColor={Palette.blue} /><Text accessibilityRole="alert" style={styles.stateCopy}>{text}</Text>{action && onPress && <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Text style={styles.actionText}>{action}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Palette.text, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  savedCountText: { color: Palette.textSecondary, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  account: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, marginBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Palette.blue, fontSize: 16, fontWeight: '700' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountLabel: { color: Palette.textSecondary, fontSize: 12, marginTop: 2 },
  accountEmail: { color: Palette.text, fontWeight: '600', fontSize: 15 },
  signOut: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' },
  signOutText: { color: Palette.blue, fontWeight: '600', fontSize: 13 },
  cards: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  card: { minHeight: 108, backgroundColor: Palette.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  cardOpen: { flex: 1, minHeight: 82, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { color: Palette.blue, fontSize: 18, fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: Palette.text, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  company: { color: Palette.text, fontWeight: '500', marginTop: 4, fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 6 },
  meta: { flex: 1, color: Palette.textSecondary, fontSize: 12 },
  date: { color: Palette.textSecondary, marginTop: 7, fontSize: 10 },
  remove: { width: 44, height: 44, minHeight: 44, minWidth: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  compare: { backgroundColor: Palette.surface, borderRadius: 14, paddingHorizontal: 16, marginTop: 24 },
  compareHeading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: Palette.text, fontSize: 18, fontWeight: '700' },
  compareRow: { borderTopWidth: 1, borderTopColor: Palette.border, paddingVertical: 12 },
  compareLabel: { color: Palette.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 7 },
  compareValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compareValue: { flex: 1, minWidth: 120, color: Palette.text, fontSize: 13, lineHeight: 18 },
  state: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  stateCopy: { color: Palette.textSecondary, textAlign: 'center', maxWidth: 360, lineHeight: 21 },
  action: { minHeight: 48, backgroundColor: Palette.blue, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center' },
  actionText: { color: Palette.white, fontWeight: '700' },
  pressed: { opacity: 0.68 },
  error: { color: Palette.danger, marginBottom: 10, fontWeight: '700' },
});
