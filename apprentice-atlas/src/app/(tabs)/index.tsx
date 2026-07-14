import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JobCard } from '@/components/jobs/job-card';
import JobMap from '@/components/map/job-map';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useJobs } from '@/hooks/use-jobs';
import { getDiscoveryState, updateDiscoveryFilters, useDiscoveryState } from '@/lib/discovery-state';
import { addFavorite, getFavoriteForJob, removeFavorite } from '@/lib/favorites';
import { localizeCountry, localizeJobError, localizeJobType, t, useLocale } from '@/lib/i18n';
import type { FavoriteJob, Job } from '@/types/jobs';

type ViewMode = 'map' | 'list';
type MapCenter = { latitude: number; longitude: number };

export default function DiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const [locale] = useLocale();
  const { filters, sort } = useDiscoveryState();
  const [searchState, setSearchState] = useState({ draft: filters.search ?? '', external: filters.search });
  const search = searchState.external === filters.search ? searchState.draft : filters.search ?? '';
  const setSearch = (draft: string) => setSearchState({ draft, external: filters.search });
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [favorite, setFavorite] = useState<FavoriteJob | null>(null);
  const [favoriteForJobId, setFavoriteForJobId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const auth = useAuth();
  const { jobs, loading, error, reload } = useJobs(filters);

  useEffect(() => {
    const timer = setTimeout(() => updateDiscoveryFilters({ search: search.trim() || undefined }), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const sortedJobs = useMemo(() => sortJobs(jobs, sort, filters.latitude, filters.longitude), [filters.latitude, filters.longitude, jobs, sort]);
  const mapJobs = useMemo(() => sortedJobs.slice(0, 120), [sortedJobs]);
  const selectedJob = useMemo(() => sortedJobs.find((job) => job.id === selectedJobId) ?? sortedJobs[0], [selectedJobId, sortedJobs]);

  useEffect(() => {
    if (!auth.session || !selectedJob) return;
    let mounted = true;
    void getFavoriteForJob(selectedJob.id).then((result) => { if (mounted) { setFavoriteForJobId(selectedJob.id); setFavorite(result.data); } });
    return () => { mounted = false; };
  }, [auth.session, selectedJob]);

  const openJob = (job: Job) => router.push(`/job/${job.id}`);
  const activeFavorite = favoriteForJobId === selectedJob?.id ? favorite : null;
  const activeFilterCount = [filters.country, filters.city, filters.category, filters.jobType, filters.level, filters.radiusKm].filter(Boolean).length;
  const locationLabel = filters.city || filters.country || t(locale, 'discovery.nearbyShort');

  const handleMapChange = (center: MapCenter) => {
    setMapCenter(center);
    const previous = getDiscoveryState().filters;
    const moved = previous.latitude === undefined || previous.longitude === undefined || Math.abs(previous.latitude - center.latitude) > 0.01 || Math.abs(previous.longitude - center.longitude) > 0.01;
    setShowSearchArea(moved);
  };

  const searchMapArea = () => {
    if (!mapCenter) return;
    updateDiscoveryFilters({ latitude: mapCenter.latitude, longitude: mapCenter.longitude, radiusKm: filters.radiusKm ?? 50, city: undefined, country: undefined });
    setShowSearchArea(false);
  };

  const toggleFavorite = async () => {
    if (!selectedJob || favoriteBusy) return;
    if (!auth.session) {
      router.push({ pathname: '/auth', params: { returnTo: '/', pendingAction: 'save', jobId: selectedJob.id } });
      return;
    }
    setFavoriteForJobId(selectedJob.id);
    setFavoriteBusy(true);
    if (activeFavorite) {
      const previous = activeFavorite;
      setFavorite(null);
      const result = await removeFavorite(selectedJob.id);
      if (result.error) setFavorite(previous);
    } else {
      const result = await addFavorite(selectedJob.id);
      if (!result.error) setFavorite(result.data);
    }
    setFavoriteBusy(false);
  };

  return (
    <View style={styles.screen}>
      {viewMode === 'map' ? (
        <JobMap jobs={mapJobs} selectedJobId={selectedJob?.id} onRegionChange={handleMapChange} onSelect={(job) => setSelectedJobId(job.id)} />
      ) : (
        <FlatList
          data={sortedJobs}
          style={styles.listScreen}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 132 }]}
          contentInsetAdjustmentBehavior="never"
          initialNumToRender={12}
          keyExtractor={(job) => job.id}
          maxToRenderPerBatch={16}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={Palette.blue} />}
          renderItem={({ item }) => <JobCard job={item} onPress={() => openJob(item)} />}
          windowSize={9}
          ListHeaderComponent={<View style={styles.listHeader}>
            <Text style={styles.listCount}>{sortedJobs.length} {locale === 'de' ? t(locale, 'discovery.jobs') : t(locale, 'discovery.jobs').toLowerCase()}</Text>
            <Text style={styles.sortLabel}>{sortLabel(locale, sort)}</Text>
          </View>}
          ListEmptyComponent={loading ? <StatePanel loading text={t(locale, 'loading.jobs')} /> : error ? <StatePanel text={localizeJobError(locale, error.code)} action={t(locale, 'discovery.retry')} onPress={() => void reload()} /> : <StatePanel text={t(locale, 'discovery.noResults')} />}
        />
      )}

      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} tintColor={Palette.textSecondary} />
            <TextInput
              accessibilityLabel={t(locale, 'discovery.searchPlaceholder')}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              onChangeText={setSearch}
              placeholder={t(locale, 'discovery.searchPlaceholder')}
              placeholderTextColor={Palette.textSecondary}
              returnKeyType="search"
              style={styles.searchInput}
              value={search}
            />
          </View>
        </View>
        <View style={styles.controls}>
          <ControlButton icon={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }} label={locationLabel} onPress={() => router.push('/location')} />
          <ControlButton badge={activeFilterCount} icon={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} label={locale === 'de' ? 'Filter' : 'Filters'} onPress={() => router.push('/filters')} />
          <ControlButton icon={viewMode === 'map' ? { ios: 'list.bullet', android: 'view_list', web: 'view_list' } : { ios: 'map', android: 'map', web: 'map' }} label={viewMode === 'map' ? t(locale, 'discovery.list') : t(locale, 'discovery.map')} onPress={() => setViewMode((current) => current === 'map' ? 'list' : 'map')} />
        </View>
        {viewMode === 'map' && showSearchArea && <Pressable accessibilityRole="button" onPress={searchMapArea} style={({ pressed }) => [styles.searchArea, pressed && styles.pressed]}><AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={15} tintColor={Palette.white} /><Text style={styles.searchAreaText}>{t(locale, 'discovery.searchArea')}</Text></Pressable>}
      </View>

      {viewMode === 'map' && (
        <View pointerEvents="box-none" style={[styles.bottom, { bottom: Math.max(insets.bottom, 10) + 66 }]}>
          <View style={styles.mapActions}>
            <View style={styles.resultLabel}><Text style={styles.resultLabelText}>{loading ? t(locale, 'loading.jobs') : `${sortedJobs.length} ${t(locale, 'discovery.results').toLowerCase()}`}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'location.chooseLocation')} onPress={() => router.push('/location')} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><AppIcon name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }} size={21} tintColor={Palette.blue} /></Pressable>
          </View>
          {loading && !selectedJob ? <StatePanel compact loading text={t(locale, 'loading.jobs')} /> : error ? <StatePanel compact text={localizeJobError(locale, error.code)} action={t(locale, 'discovery.retry')} onPress={() => void reload()} /> : selectedJob ? <JobPreview favorite={Boolean(activeFavorite)} favoriteBusy={favoriteBusy} job={selectedJob} locale={locale} onDetails={() => openJob(selectedJob)} onFavorite={() => void toggleFavorite()} /> : <StatePanel compact text={t(locale, 'discovery.noResults')} />}
        </View>
      )}
    </View>
  );
}

function ControlButton({ badge, icon, label, onPress }: { badge?: number; icon: { ios: string; android: string; web: string }; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.control, pressed && styles.pressed]}><AppIcon name={icon as never} size={16} tintColor={Palette.text} /><Text style={styles.controlText} numberOfLines={1}>{label}</Text>{Boolean(badge) && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}</Pressable>;
}

function JobPreview({ favorite, favoriteBusy, job, locale, onDetails, onFavorite }: { favorite: boolean; favoriteBusy: boolean; job: Job; locale: 'de' | 'en'; onDetails: () => void; onFavorite: () => void }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.previewTitle} numberOfLines={2}>{job.title}</Text>
      <Text style={styles.previewCompany} numberOfLines={1}>{job.company}</Text>
      <Text style={styles.previewMeta} numberOfLines={1}>{job.city}, {localizeCountry(locale, job.country)} · {localizeJobType(locale, job.jobType)}</Text>
      <View style={styles.previewActions}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: favorite, disabled: favoriteBusy }} disabled={favoriteBusy} onPress={onFavorite} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>{favoriteBusy ? <ActivityIndicator color={Palette.blue} /> : <AppIcon name={favorite ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={20} tintColor={Palette.blue} />}<Text style={styles.saveButtonText}>{favorite ? t(locale, 'actions.saved') : t(locale, 'actions.save')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onDetails} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}><Text style={styles.detailsButtonText}>{t(locale, 'discovery.details')}</Text></Pressable>
      </View>
    </View>
  );
}

function StatePanel({ text, action, onPress, loading, compact }: { text: string; action?: string; onPress?: () => void; loading?: boolean; compact?: boolean }) {
  return <View style={[styles.state, compact && styles.stateCompact]} accessibilityRole="alert">{loading && <ActivityIndicator color={Palette.blue} />}<Text style={styles.stateText}>{text}</Text>{action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={styles.retry}><Text style={styles.retryText}>{action}</Text></Pressable>}</View>;
}

function sortLabel(locale: 'de' | 'en', sort: 'recent' | 'distance' | 'title') {
  return t(locale, sort === 'distance' ? 'discovery.sortDistance' : sort === 'title' ? 'discovery.sortTitle' : 'discovery.sortRecent');
}

function sortJobs(jobs: Job[], sort: 'recent' | 'distance' | 'title', latitude?: number, longitude?: number) {
  const next = [...jobs];
  if (sort === 'title') return next.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'distance' && latitude !== undefined && longitude !== undefined) return next.sort((a, b) => distance(a, latitude, longitude) - distance(b, latitude, longitude));
  return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function distance(job: Job, latitude: number, longitude: number) {
  if (job.latitude === null || job.longitude === null) return Number.POSITIVE_INFINITY;
  return (job.latitude - latitude) ** 2 + (job.longitude - longitude) ** 2;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  top: { position: 'absolute', left: 12, right: 12, zIndex: 10, gap: 8 },
  searchRow: { flexDirection: 'row' },
  searchBar: { flex: 1, height: 50, borderRadius: 15, borderCurve: 'continuous', backgroundColor: Palette.white, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, boxShadow: '0 2px 10px rgba(15, 23, 42, 0.14)' },
  searchInput: { flex: 1, height: '100%', color: Palette.text, fontSize: 16 },
  controls: { flexDirection: 'row', gap: 7 },
  control: { minHeight: 38, maxWidth: 160, borderRadius: 12, borderCurve: 'continuous', backgroundColor: Palette.white, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, boxShadow: '0 1px 6px rgba(15, 23, 42, 0.12)' },
  controlText: { flexShrink: 1, color: Palette.text, fontSize: 13, fontWeight: '600' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: Palette.white, fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  searchArea: { alignSelf: 'center', minHeight: 38, borderRadius: 19, backgroundColor: Palette.blue, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(21, 94, 239, 0.24)' },
  searchAreaText: { color: Palette.white, fontSize: 13, fontWeight: '700' },
  listScreen: { flex: 1, backgroundColor: Palette.white },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  listHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  listCount: { color: Palette.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sortLabel: { color: Palette.textSecondary, fontSize: 13 },
  bottom: { position: 'absolute', left: 12, right: 12, zIndex: 9, gap: 8 },
  mapActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultLabel: { minHeight: 36, borderRadius: 18, backgroundColor: Palette.white, paddingHorizontal: 12, justifyContent: 'center', boxShadow: '0 1px 6px rgba(15, 23, 42, 0.12)' },
  resultLabelText: { color: Palette.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.16)' },
  sheet: { backgroundColor: Palette.white, borderRadius: 22, borderCurve: 'continuous', paddingHorizontal: 18, paddingTop: 9, paddingBottom: 16, boxShadow: '0 8px 28px rgba(15, 23, 42, 0.18)' },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 10 },
  previewTitle: { color: Palette.text, fontSize: 20, lineHeight: 24, fontWeight: '700', letterSpacing: -0.25 },
  previewCompany: { color: Palette.text, fontSize: 14, fontWeight: '500', marginTop: 4 },
  previewMeta: { color: Palette.textSecondary, fontSize: 13, marginTop: 4 },
  previewActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  saveButton: { minHeight: 46, minWidth: 112, borderRadius: 12, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveButtonText: { color: Palette.blue, fontSize: 15, fontWeight: '700' },
  detailsButton: { flex: 1, minHeight: 46, borderRadius: 12, borderCurve: 'continuous', backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  detailsButtonText: { color: Palette.white, fontSize: 15, fontWeight: '700' },
  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, backgroundColor: Palette.white },
  stateCompact: { minHeight: 104, borderRadius: 18, borderCurve: 'continuous', boxShadow: '0 5px 20px rgba(15, 23, 42, 0.14)' },
  stateText: { color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
  retry: { minHeight: 42, paddingHorizontal: 14, justifyContent: 'center' },
  retryText: { color: Palette.blue, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
