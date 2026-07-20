import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { HomeJobCard } from '@/components/home/home-job-card';
import { CompanyBrandMark } from '@/components/company/company-brand-mark';
import { useLaunchReadiness } from '@/components/launch/launch-gate';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { BottomTabInset, Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useJobs } from '@/hooks/use-jobs';
import { usePreferences } from '@/hooks/use-preferences';
import { deriveAtlasNextAction, type AtlasNextAction } from '@/lib/atlas-next-action';
import { listApplications } from '@/lib/applications';
import { updateDiscoveryFilters, useDiscoveryState } from '@/lib/discovery-state';
import { listFavorites } from '@/lib/favorites';
import { getHomeJobDistanceKm, rankHomeJobs, selectUpcomingDeadlines, type UpcomingHomeDeadline } from '@/lib/home-presentation';
import { localizeCategory, localizeCountry, t, useLocale, type Locale } from '@/lib/i18n';
import type { FavoriteJob, Job, TrackedApplication } from '@/types/jobs';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [locale] = useLocale();
  const auth = useAuth();
  const { preferences } = usePreferences();
  const { filters } = useDiscoveryState();
  const country = filters.country ?? preferences.country ?? 'Germany';
  const { jobs, loading, error, reload } = useJobs({ country });
  const { markDiscoveryReady } = useLaunchReadiness();
  const [favorites, setFavorites] = useState<FavoriteJob[]>([]);
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime] = useState(() => Date.now());
  const privateGeneration = useRef(0);
  const userId = auth.session?.user.id ?? null;
  const sessionKey = auth.session ? `${auth.session.user.id}:${auth.session.access_token}` : null;

  useEffect(() => {
    if (!loading) markDiscoveryReady();
  }, [loading, markDiscoveryReady]);

  const loadPrivateData = useCallback(async () => {
    const generation = ++privateGeneration.current;
    if (auth.loading) return;
    if (!userId || !sessionKey) {
      setFavorites([]);
      setApplications([]);
      setPrivateLoading(false);
      return;
    }
    setPrivateLoading(true);
    const [favoriteResult, applicationResult] = await Promise.all([
      listFavorites({ expectedUserId: userId }),
      listApplications({ expectedUserId: userId }),
    ]);
    if (generation !== privateGeneration.current) return;
    setFavorites(favoriteResult.data ?? []);
    setApplications(applicationResult.data ?? []);
    setPrivateLoading(false);
  }, [auth.loading, sessionKey, userId]);

  useFocusEffect(useCallback(() => {
    void loadPrivateData();
    return () => { privateGeneration.current += 1; };
  }, [loadPrivateData]));

  const coordinates = useMemo(() => filters.latitude !== undefined && filters.longitude !== undefined
    ? { latitude: filters.latitude, longitude: filters.longitude }
    : null, [filters.latitude, filters.longitude]);
  const recommendations = useMemo(() => rankHomeJobs({
    jobs,
    country,
    savedJobIds: favorites.map((favorite) => favorite.jobId),
    trackedJobIds: applications.map((application) => application.jobId),
    interestCategories: preferences.interests,
    coordinates,
  }), [applications, coordinates, country, favorites, jobs, preferences.interests]);
  const nextAction = useMemo(() => deriveAtlasNextAction(applications), [applications]);
  const deadlines = useMemo(() => selectUpcomingDeadlines({ favorites, applications }), [applications, favorites]);
  const activeApplications = useMemo(() => applications.filter((application) => application.status !== 'closed'), [applications]);
  const interests = preferences.interests.length > 0 ? preferences.interests : ['technology', 'business', 'skilled-trades', 'general'];
  const nearbyCount = useMemo(() => {
    if (!coordinates) return jobs.filter((job) => job.latitude !== null && job.longitude !== null).length;
    const radius = filters.radiusKm ?? 50;
    return jobs.filter((job) => {
      const distance = getHomeJobDistanceKm(job, coordinates);
      return distance !== null && distance <= radius;
    }).length;
  }, [coordinates, filters.radiusKm, jobs]);
  const cardWidth = Math.min(Math.max(width * 0.74, 266), 302);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), loadPrivateData()]);
    setRefreshing(false);
  };

  const openNextAction = () => {
    if (nextAction.kind === 'prepare-interview' && nextAction.application) {
      router.push({ pathname: '/prepare/[jobId]', params: { jobId: nextAction.application.jobId } });
    } else if (nextAction.application) {
      router.push({ pathname: '/application/[jobId]', params: { jobId: nextAction.application.jobId } });
    } else {
      router.push({ pathname: '/map', params: { view: 'list' } });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + 38 }]}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={Palette.blue} onRefresh={() => void refresh()} />}
      style={styles.screen}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t(locale, 'home.eyebrow')}</Text>
          <Text style={styles.title}>{t(locale, 'home.title')}</Text>
        </View>
        <Pressable accessibilityLabel={t(locale, 'settings.title')} accessibilityRole="button" onPress={() => router.push({ pathname: '/settings', params: { from: 'home' } })} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
          <AppIcon name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={21} tintColor={Palette.text} />
        </Pressable>
      </View>

      <Pressable accessibilityRole="search" onPress={() => router.push('/search')} style={({ pressed }) => [styles.search, pressed && styles.pressed]}>
        <AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={Palette.textSecondary} />
        <Text style={styles.searchText}>{t(locale, 'discovery.searchPlaceholder')}</Text>
      </Pressable>

      {!privateLoading && auth.session && (
        <SnapshotStrip
          active={activeApplications.length}
          deadlines={deadlines.length}
          locale={locale}
          onApplications={() => router.push('/atlas')}
          onDeadlines={() => router.push('/favorites')}
          onSaved={() => router.push('/favorites')}
          saved={favorites.length}
        />
      )}

      {!privateLoading && nextAction.application && (
        <NextActionHero action={nextAction} locale={locale} onPress={openNextAction} />
      )}

      <SectionHeader action={t(locale, 'home.viewAll')} onAction={() => router.push({ pathname: '/map', params: { view: 'list' } })} title={t(locale, 'home.forYou')} />
      {loading && recommendations.length === 0 ? (
        <LoadingPanel locale={locale} />
      ) : error && recommendations.length === 0 ? (
        <InlineState action={t(locale, 'atlas.retry')} body={t(locale, 'home.jobsError')} onPress={() => void reload()} />
      ) : recommendations.length === 0 ? (
        <InlineState body={t(locale, 'home.noRecommendations')} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.cardRail}
          decelerationRate="fast"
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
        >
          {recommendations.map(({ job, distanceKm }) => (
            <HomeJobCard
              distanceKm={distanceKm}
              job={job}
              key={job.id}
              locale={locale}
              onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}
              width={cardWidth}
            />
          ))}
        </ScrollView>
      )}

      <InterestRail
        interests={interests}
        locale={locale}
        onSelect={(category) => {
          updateDiscoveryFilters({ category, country });
          router.push({ pathname: '/map', params: { view: 'list' } });
        }}
      />

      <NearbyPreview
        country={country}
        count={nearbyCount}
        jobs={jobs}
        locale={locale}
        located={Boolean(coordinates)}
        onPress={() => router.push({ pathname: '/map', params: { view: 'map' } })}
      />

      {deadlines.length > 0 && (
        <View style={styles.deadlineSection}>
          <SectionHeader title={t(locale, 'home.deadlines')} />
          <View style={styles.deadlineList}>
            {deadlines.map((deadline, index) => (
              <DeadlineRow deadline={deadline} key={deadline.job.id} last={index === deadlines.length - 1} locale={locale} now={currentTime} onPress={() => router.push({ pathname: '/job/[id]', params: { id: deadline.job.id } })} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function NextActionHero({ action, locale, onPress }: { action: AtlasNextAction; locale: Locale; onPress: () => void }) {
  const job = action.application?.job;
  const actionKey = action.kind === 'start-application' ? 'start'
    : action.kind === 'continue-application' ? 'continue'
      : action.kind === 'follow-up' ? 'followUp'
        : action.kind === 'prepare-interview' ? 'interview'
          : 'offer';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroIcon}>
          {job
            ? <CompanyBrandMark company={job.company} size={38} />
            : <AppIcon name={{ ios: 'arrow.triangle.branch', android: 'alt_route', web: 'alt_route' }} size={19} tintColor={Palette.white} />}
        </View>
        <Text style={styles.heroEyebrow}>{t(locale, 'home.nextStep')}</Text>
      </View>
      <Text style={styles.heroTitle}>{t(locale, `home.next.${actionKey}`)}</Text>
      {job && <Text numberOfLines={2} style={styles.heroTarget}>{job.title} · {job.company}</Text>}
      <View style={styles.heroAction}>
        <Text style={styles.heroActionText}>{t(locale, 'home.continue')}</Text>
        <AppIcon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={17} tintColor={Palette.white} />
      </View>
    </Pressable>
  );
}

function SnapshotStrip({ active, deadlines, locale, onApplications, onDeadlines, onSaved, saved }: {
  active: number;
  deadlines: number;
  locale: Locale;
  onApplications: () => void;
  onDeadlines: () => void;
  onSaved: () => void;
  saved: number;
}) {
  const items: { label: string; value: number; icon: AppIconName; onPress: () => void }[] = [
    { label: t(locale, 'home.snapshotSaved'), value: saved, icon: { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }, onPress: onSaved },
    { label: t(locale, 'home.snapshotActive'), value: active, icon: { ios: 'arrow.triangle.branch', android: 'alt_route', web: 'alt_route' }, onPress: onApplications },
    { label: t(locale, 'home.snapshotDeadlines'), value: deadlines, icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }, onPress: onDeadlines },
  ];
  return (
    <View style={styles.snapshotStrip}>
      {items.map((item, index) => (
        <Pressable accessibilityRole="button" key={item.label} onPress={item.onPress} style={({ pressed }) => [styles.snapshotItem, index > 0 && styles.snapshotDivider, pressed && styles.snapshotPressed]}>
          <AppIcon name={item.icon} size={16} tintColor={Palette.blue} />
          <Text style={styles.snapshotValue}>{item.value}</Text>
          <Text numberOfLines={1} style={styles.snapshotLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function InterestRail({ interests, locale, onSelect }: { interests: string[]; locale: Locale; onSelect: (interest: string) => void }) {
  const icons: AppIconName[] = [
    { ios: 'laptopcomputer', android: 'computer', web: 'computer' },
    { ios: 'chart.bar.fill', android: 'monitoring', web: 'monitoring' },
    { ios: 'wrench.and.screwdriver.fill', android: 'construction', web: 'construction' },
    { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  ];
  return (
    <View style={styles.interestSection}>
      <SectionHeader title={t(locale, 'home.exploreInterests')} />
      <ScrollView contentContainerStyle={styles.interestRail} horizontal showsHorizontalScrollIndicator={false}>
        {interests.map((interest, index) => (
          <Pressable accessibilityRole="button" key={interest} onPress={() => onSelect(interest)} style={({ pressed }) => [styles.interestCard, pressed && styles.pressed]}>
            <View style={styles.interestIcon}><AppIcon name={icons[index % icons.length]} size={19} tintColor={Palette.blue} /></View>
            <Text numberOfLines={2} style={styles.interestLabel}>{localizeCategory(locale, interest)}</Text>
            <AppIcon name={{ ios: 'arrow.up.right', android: 'arrow_outward', web: 'arrow_outward' }} size={14} tintColor={Palette.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function NearbyPreview({ country, count, jobs, locale, located, onPress }: { country: string; count: number; jobs: Job[]; locale: Locale; located: boolean; onPress: () => void }) {
  const mapJobs = jobs.filter((job) => job.latitude !== null && job.longitude !== null).slice(0, 6);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.nearbyPreview, pressed && styles.pressed]}>
      <View style={styles.miniMap}>
        <View style={[styles.mapRoad, styles.mapRoadOne]} />
        <View style={[styles.mapRoad, styles.mapRoadTwo]} />
        <View style={[styles.mapRoad, styles.mapRoadThree]} />
        {mapJobs.map((job, index) => {
          const left = `${12 + (Math.abs((job.longitude ?? index) * 37) % 72)}%` as `${number}%`;
          const top = `${13 + (Math.abs((job.latitude ?? index) * 29) % 58)}%` as `${number}%`;
          return <View key={job.id} style={[styles.mapPin, { left, top }]}><View style={styles.mapPinCore} /></View>;
        })}
        <View style={styles.mapCountPill}>
          <AppIcon name={{ ios: 'map.fill', android: 'map', web: 'map' }} size={14} tintColor={Palette.blue} />
          <Text style={styles.mapCountText}>{t(locale, 'home.openMap')}</Text>
        </View>
      </View>
      <View style={styles.nearbyFooter}>
        <View style={styles.nearbyCopy}>
          <Text style={styles.nearbyTitle}>{t(locale, 'home.nearby')}</Text>
          <Text numberOfLines={2} style={styles.nearbyBody}>{located
            ? t(locale, 'home.nearbyCount').replace('{count}', String(count))
            : t(locale, 'home.nearbyCountry').replace('{country}', localizeCountry(locale, country))}</Text>
        </View>
        <View style={styles.nearbyArrow}><AppIcon name={{ ios: 'arrow.up.right', android: 'arrow_outward', web: 'arrow_outward' }} size={17} tintColor={Palette.blue} /></View>
      </View>
    </Pressable>
  );
}

function SectionHeader({ action, onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function LoadingPanel({ locale }: { locale: Locale }) {
  return <View accessibilityRole="progressbar" style={styles.inlineState}><ActivityIndicator color={Palette.blue} /><Text style={styles.inlineBody}>{t(locale, 'loading.jobs')}</Text></View>;
}

function InlineState({ action, body, onPress }: { action?: string; body: string; onPress?: () => void }) {
  return (
    <View style={styles.inlineState}>
      <Text style={styles.inlineBody}>{body}</Text>
      {action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={styles.inlineButton}><Text style={styles.inlineButtonText}>{action}</Text></Pressable>}
    </View>
  );
}

function DeadlineRow({ deadline, last, locale, now, onPress }: { deadline: UpcomingHomeDeadline; last: boolean; locale: Locale; now: number; onPress: () => void }) {
  const days = Math.max(1, Math.ceil((deadline.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.deadlineRow, !last && styles.deadlineDivider, pressed && styles.pressed]}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateNumber}>{deadline.expiresAt.getDate()}</Text>
        <Text style={styles.dateMonth}>{deadline.expiresAt.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { month: 'short' }).replace('.', '')}</Text>
      </View>
      <View style={styles.deadlineCopy}>
        <Text numberOfLines={1} style={styles.deadlineTitle}>{deadline.job.title}</Text>
        <Text numberOfLines={1} style={styles.deadlineMeta}>{t(locale, days === 1 ? 'home.deadlineTomorrow' : 'home.deadlineDays').replace('{days}', String(days))}</Text>
      </View>
      <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={Palette.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: Palette.blue, fontSize: 13, lineHeight: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: Palette.text, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  search: { minHeight: 56, borderRadius: Radius.medium, borderCurve: 'continuous', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  searchText: { flex: 1, color: Palette.textSecondary, fontSize: 16 },
  snapshotStrip: { minHeight: 78, flexDirection: 'row', overflow: 'hidden', borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.blueSoft },
  snapshotItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 10 },
  snapshotDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(21,94,239,0.18)' },
  snapshotPressed: { backgroundColor: 'rgba(21,94,239,0.08)' },
  snapshotValue: { color: Palette.blueDark, fontSize: 18, lineHeight: 21, fontWeight: '900', fontVariant: ['tabular-nums'] },
  snapshotLabel: { color: Palette.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  hero: { minHeight: 188, borderRadius: 26, borderCurve: 'continuous', padding: 20, backgroundColor: Palette.blue, overflow: 'hidden' },
  heroPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  heroIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  heroEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: Palette.white, fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5 },
  heroTarget: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 7 },
  heroAction: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  heroActionText: { color: Palette.white, fontSize: 15, fontWeight: '800' },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { flex: 1, color: Palette.text, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.4 },
  sectionAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  sectionActionText: { color: Palette.blue, fontSize: 14, fontWeight: '800' },
  cardRail: { gap: 12, paddingRight: 18, paddingBottom: 4 },
  interestSection: { gap: 6 },
  interestRail: { gap: 10, paddingRight: 18 },
  interestCard: { width: 132, minHeight: 112, borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.surface, padding: 13, justifyContent: 'space-between', alignItems: 'flex-start' },
  interestIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  interestLabel: { minHeight: 34, color: Palette.text, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  inlineState: { minHeight: 120, borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 22 },
  inlineBody: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inlineButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  inlineButtonText: { color: Palette.blue, fontSize: 14, fontWeight: '800' },
  nearbyPreview: { overflow: 'hidden', borderRadius: Radius.large, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  miniMap: { height: 142, overflow: 'hidden', backgroundColor: '#DCE9FF' },
  mapRoad: { position: 'absolute', height: 10, width: '125%', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.78)' },
  mapRoadOne: { top: 29, left: -24, transform: [{ rotate: '10deg' }] },
  mapRoadTwo: { top: 83, left: -14, transform: [{ rotate: '-13deg' }] },
  mapRoadThree: { top: 53, left: 68, transform: [{ rotate: '76deg' }] },
  mapPin: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blue, borderWidth: 3, borderColor: Palette.white, boxShadow: '0 3px 8px rgba(8,31,77,0.22)' },
  mapPinCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.white },
  mapCountPill: { position: 'absolute', left: 12, bottom: 11, minHeight: 35, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, backgroundColor: Palette.white, boxShadow: '0 4px 12px rgba(8,31,77,0.12)' },
  mapCountText: { color: Palette.blueDark, fontSize: 12, fontWeight: '800' },
  nearbyFooter: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 17, paddingVertical: 14 },
  nearbyCopy: { flex: 1, minWidth: 0, gap: 4 },
  nearbyTitle: { color: Palette.text, fontSize: 17, fontWeight: '900' },
  nearbyBody: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
  nearbyArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  deadlineSection: { gap: 7 },
  deadlineList: { overflow: 'hidden', borderRadius: Radius.large, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  deadlineRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 11 },
  deadlineDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  dateBadge: { width: 49, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  dateNumber: { color: Palette.blueDark, fontSize: 19, lineHeight: 21, fontWeight: '900' },
  dateMonth: { color: Palette.blue, fontSize: 10, lineHeight: 13, fontWeight: '900', textTransform: 'uppercase' },
  deadlineCopy: { flex: 1, minWidth: 0, gap: 4 },
  deadlineTitle: { color: Palette.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  deadlineMeta: { color: Palette.textSecondary, fontSize: 13, lineHeight: 17 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
