import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { advanceFavoriteOwnership, beginFavoriteRemoval, buildComparisonRows, createFavoriteOwnership, favoriteOwnershipKey, getReadableFavoritesError, isCurrentFavoriteOperation, isFavoritesLoading, listFavorites, removeFavorite, rollbackFavoriteRemoval, type FavoritesError } from '@/lib/favorites';
import { localizeCountry, localizeJobType, t, useLocale, type Locale } from '@/lib/i18n';
import type { FavoriteJob } from '@/types/jobs';

export default function FavoritesScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const auth = useAuth();
  const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
  const [loadedForOwnershipKey, setLoadedForOwnershipKey] = useState<string | null>(null);
  const [error, setError] = useState<FavoritesError | null>(null);
  const [errorOperation, setErrorOperation] = useState<'save' | 'remove'>('save');
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [pendingJobIds, setPendingJobIds] = useState<Set<string>>(() => new Set());
  const pendingOperationIdsRef = useRef(new Set<string>());
  const listRevisionRef = useRef(0);
  const userId = auth.session?.user.id ?? null;
  const [ownership, setOwnership] = useState(() => createFavoriteOwnership(userId));
  let currentOwnership = ownership;
  if (ownership.userId !== userId) {
    currentOwnership = advanceFavoriteOwnership(ownership, userId);
    setOwnership(currentOwnership);
  }
  const ownershipKey = favoriteOwnershipKey(currentOwnership);
  const currentOwnershipKeyRef = useRef<string | null>(ownershipKey);

  useLayoutEffect(() => {
    currentOwnershipKeyRef.current = ownershipKey;
  }, [ownershipKey]);
  const loading = isFavoritesLoading(auth.loading, ownershipKey, loadedForOwnershipKey);
  const currentFavorites = loadedForOwnershipKey === ownershipKey ? favorites : [];
  const currentError = loadedForOwnershipKey === ownershipKey ? error : null;

  const loadFavorites = useCallback(() => {
    if (!ownershipKey) return undefined;
    void refreshAttempt;
    let active = true;
    const operationKey = ownershipKey;
    const listRevision = ++listRevisionRef.current;
    setFavorites([]);
    setError(null);
    setLoadedForOwnershipKey(null);
    const operationPrefix = `${operationKey}\u0000`;
    setPendingJobIds(new Set(
      [...pendingOperationIdsRef.current]
        .filter((operationId) => operationId.startsWith(operationPrefix))
        .map((operationId) => operationId.slice(operationPrefix.length)),
    ));
    void listFavorites().then((result) => {
      if (!active || listRevision !== listRevisionRef.current || !isCurrentFavoriteOperation(operationKey, currentOwnershipKeyRef.current)) return;
      setFavorites(result.data ?? []);
      setError(result.error);
      setErrorOperation('save');
      setLoadedForOwnershipKey(operationKey);
    });
    return () => { active = false; };
  }, [ownershipKey, refreshAttempt]);

  useFocusEffect(loadFavorites);

  const remove = async (favorite: FavoriteJob) => {
    const operationKey = ownershipKey;
    if (!operationKey || loadedForOwnershipKey !== operationKey) return;
    const operationId = `${operationKey}\u0000${favorite.jobId}`;
    if (pendingOperationIdsRef.current.has(operationId)) return;
    listRevisionRef.current += 1;
    setLoadedForOwnershipKey(operationKey);
    pendingOperationIdsRef.current.add(operationId);
    setPendingJobIds((current) => new Set(current).add(favorite.jobId));
    setFavorites((current) => beginFavoriteRemoval(current, favorite.jobId).favorites);
    setError(null);
    const result = await removeFavorite(favorite.jobId);
    listRevisionRef.current += 1;
    pendingOperationIdsRef.current.delete(operationId);
    if (!isCurrentFavoriteOperation(operationKey, currentOwnershipKeyRef.current)) return;
    setPendingJobIds((current) => {
      const next = new Set(current);
      next.delete(favorite.jobId);
      return next;
    });
    if (result.error) {
      setFavorites((current) => rollbackFavoriteRemoval(current, favorite));
      setError(result.error);
      setErrorOperation('remove');
    } else {
      setFavorites((current) => beginFavoriteRemoval(current, favorite.jobId).favorites);
    }
  };

  const retry = () => {
    setError(null);
    setLoadedForOwnershipKey(null);
    setRefreshAttempt((attempt) => attempt + 1);
  };

  const mappedError = currentError ? getReadableFavoritesError(currentError, locale, errorOperation) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>{t(locale, 'saved.title')}</Text>
          <Text accessibilityLabel={`${t(locale, 'saved.title')}: ${currentFavorites.length}`} style={styles.savedCountText}>{currentFavorites.length}</Text>
        </View>

        {loading ? (
          <SavedState loading text={t(locale, 'saved.loading')} />
        ) : !auth.session ? (
          <SavedState
            action={t(locale, 'saved.signIn')}
            icon={{ ios: 'person.crop.circle.badge.plus', android: 'person_add', web: 'person_add' }}
            onPress={() => router.push('/auth')}
            text={t(locale, 'saved.description')}
            title={t(locale, 'saved.signedOutTitle')}
          />
        ) : currentError && currentFavorites.length === 0 ? (
          <SavedState
            action={t(locale, 'discovery.retry')}
            error
            icon={{ ios: 'arrow.clockwise.circle', android: 'refresh', web: 'refresh' }}
            onPress={retry}
            text={mappedError ?? t(locale, 'saved.errorLoad')}
          />
        ) : currentFavorites.length === 0 ? (
          <EmptySaved locale={locale} onPress={() => router.push('/')} />
        ) : (
          <>
            {mappedError && <Text accessibilityRole="alert" style={styles.error}>{mappedError}</Text>}
            <View style={styles.cards}>
              {currentFavorites.map((favorite) => (
                <FavoriteCard
                  key={favorite.id}
                  favorite={favorite}
                  locale={locale}
                  onOpen={() => favorite.job && router.push(`/job/${favorite.job.id}`)}
                  onRemove={() => void remove(favorite)}
                  pending={pendingJobIds.has(favorite.jobId)}
                />
              ))}
            </View>
            {currentFavorites.length > 1 && <Comparison favorites={currentFavorites} locale={locale} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FavoriteCard({ favorite, onRemove, onOpen, pending, locale }: { favorite: FavoriteJob; onRemove: () => void; onOpen: () => void; pending: boolean; locale: Locale }) {
  const job = favorite.job;
  const archived = t(locale, 'saved.archived');
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={job?.title ?? t(locale, 'saved.unavailable')}
        accessibilityRole="button"
        accessibilityState={{ disabled: !job }}
        disabled={!job}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardOpen, pressed && styles.pressed]}
      >
        <View style={styles.cardIcon}><Text style={styles.cardIconText}>{(job?.company ?? '?').slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.cardCopy}>
          <Text numberOfLines={2} style={styles.cardTitle}>{job?.title ?? t(locale, 'saved.unavailable')}</Text>
          <Text numberOfLines={1} style={styles.company}>{job?.company ?? archived}</Text>
          <View style={styles.metaRow}>
            <AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={15} tintColor={Palette.textSecondary} />
            <Text numberOfLines={1} style={styles.meta}>{job ? `${job.city}, ${localizeCountry(locale, job.country)} · ${localizeJobType(locale, job.jobType)}` : archived}</Text>
          </View>
          <Text style={styles.date}>{job?.sourceName ?? archived} · {new Date(job?.lastSeenAt || favorite.createdAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`${t(locale, 'saved.remove')}: ${job?.title ?? t(locale, 'saved.unavailable')}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: pending }}
        disabled={pending}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
      >
        {pending
          ? <ActivityIndicator color={Palette.blue} />
          : <AppIcon name={{ ios: 'bookmark.slash', android: 'bookmark_remove', web: 'bookmark_remove' }} size={19} tintColor={Palette.blue} />}
      </Pressable>
    </View>
  );
}

function Comparison({ favorites, locale }: { favorites: FavoriteJob[]; locale: Locale }) {
  return (
    <View style={styles.compare}>
      <View style={styles.compareHeading}><Text style={styles.heading}>{t(locale, 'saved.compare')}</Text><AppIcon name={{ ios: 'square.split.2x1', android: 'compare', web: 'compare' }} size={18} tintColor={Palette.textSecondary} /></View>
      {buildComparisonRows(favorites, locale).map((row) => (
        <View key={row.label} style={styles.compareRow}>
          <Text style={styles.compareLabel}>{row.label}</Text>
          <View style={styles.compareValues}>{row.values.map((value, index) => <Text key={`${row.label}-${index}`} style={styles.compareValue}>{value}</Text>)}</View>
        </View>
      ))}
    </View>
  );
}

function SavedState({ action, error, icon, loading, onPress, text, title }: { action?: string; error?: boolean; icon?: Parameters<typeof AppIcon>[0]['name']; loading?: boolean; onPress?: () => void; text: string; title?: string }) {
  return (
    <View accessibilityRole={error ? 'alert' : undefined} style={styles.state}>
      {loading ? <ActivityIndicator color={Palette.blue} /> : <AppIcon name={icon ?? { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={38} tintColor={Palette.blue} />}
      {title && <Text style={styles.stateTitle}>{title}</Text>}
      <Text style={styles.stateCopy}>{text}</Text>
      {action && onPress && (
        <Pressable accessibilityLabel={action} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptySaved({ locale, onPress }: { locale: Locale; onPress: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><AppIcon name={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={38} tintColor={Palette.blue} /></View>
      <Text style={styles.emptyTitle}>{t(locale, 'saved.emptyTitle')}</Text>
      <Text style={styles.emptyCopy}>{t(locale, 'saved.emptyHint')}</Text>
      <Pressable accessibilityLabel={t(locale, 'saved.emptyAction')} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
        <Text style={styles.emptyActionText}>{t(locale, 'saved.emptyAction')}</Text>
        <AppIcon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={17} tintColor={Palette.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  savedCountText: { minWidth: 32, color: Palette.textSecondary, fontSize: 17, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  cards: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  card: { minHeight: 112, backgroundColor: Palette.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  cardOpen: { flex: 1, minHeight: 84, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { color: Palette.blue, fontSize: 18, fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: Palette.text, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  company: { color: Palette.text, fontWeight: '500', marginTop: 3, fontSize: 13 },
  metaRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 6 },
  meta: { flex: 1, color: Palette.textSecondary, fontSize: 13 },
  date: { color: Palette.textSecondary, marginTop: 6, fontSize: 13, lineHeight: 18 },
  remove: { width: 44, height: 44, minHeight: 44, minWidth: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  compare: { marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  compareHeading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: Palette.text, fontSize: 18, fontWeight: '700' },
  compareRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border, paddingVertical: 12 },
  compareLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  compareValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compareValue: { flex: 1, minWidth: 120, color: Palette.text, fontSize: 13, lineHeight: 18 },
  state: { width: '100%', minHeight: 330, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  stateTitle: { color: Palette.text, fontSize: 21, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  stateCopy: { color: Palette.textSecondary, fontSize: 15, textAlign: 'center', maxWidth: 360, lineHeight: 22 },
  emptyState: { minHeight: 380, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyIcon: { width: 76, height: 76, borderRadius: 24, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: Palette.text, fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  emptyCopy: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 310, marginTop: 8 },
  emptyAction: { minHeight: 50, borderRadius: 14, backgroundColor: Palette.blue, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 22 },
  emptyActionText: { color: Palette.white, fontSize: 16, fontWeight: '700' },
  action: { minHeight: 48, backgroundColor: Palette.blue, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center', marginTop: 8 },
  actionText: { color: Palette.white, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  error: { color: Palette.danger, marginBottom: 10, fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
