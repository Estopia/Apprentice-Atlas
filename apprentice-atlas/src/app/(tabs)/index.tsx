import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { HomeJobCard } from '@/components/home/home-job-card';
import { useLaunchReadiness } from '@/components/launch/launch-gate';
import { AppIcon } from '@/components/ui/app-icon';
import { BottomTabInset, Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useJobs } from '@/hooks/use-jobs';
import { usePreferences } from '@/hooks/use-preferences';
import { deriveAtlasNextAction, type AtlasNextAction } from '@/lib/atlas-next-action';
import { listApplications } from '@/lib/applications';
import { useDiscoveryState } from '@/lib/discovery-state';
import { listFavorites } from '@/lib/favorites';
import { getHomeJobDistanceKm, rankHomeJobs, selectUpcomingDeadlines, type UpcomingHomeDeadline } from '@/lib/home-presentation';
import { localizeCountry, t, useLocale, type Locale } from '@/lib/i18n';
import type { FavoriteJob, TrackedApplication } from '@/types/jobs';

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
  const nearbyCount = useMemo(() => {
    if (!coordinates) return jobs.filter((job) => job.latitude !== null && job.longitude !== null).length;
    const radius = filters.radiusKm ?? 50;
    return jobs.filter((job) => {
      const distance = getHomeJobDistanceKm(job, coordinates);
      return distance !== null && distance <= radius;
    }).length;
  }, [coordinates, filters.radiusKm, jobs]);
  const cardWidth = Math.min(Math.max(width - 64, 278), 336);

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
        <Pressable accessibilityLabel={t(locale, 'settings.title')} accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
          <AppIcon name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={21} tintColor={Palette.text} />
        </Pressable>
      </View>

      <Pressable accessibilityRole="search" onPress={() => router.push('/search')} style={({ pressed }) => [styles.search, pressed && styles.pressed]}>
        <AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={Palette.textSecondary} />
        <Text style={styles.searchText}>{t(locale, 'discovery.searchPlaceholder')}</Text>
      </Pressable>

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

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/map', params: { view: 'map' } })} style={({ pressed }) => [styles.nearbyCard, pressed && styles.pressed]}>
        <View style={styles.nearbyIcon}>
          <AppIcon name={{ ios: 'map.fill', android: 'map', web: 'map' }} size={23} tintColor={Palette.blue} />
        </View>
        <View style={styles.nearbyCopy}>
          <Text style={styles.nearbyTitle}>{t(locale, 'home.nearby')}</Text>
          <Text numberOfLines={2} style={styles.nearbyBody}>{coordinates
            ? t(locale, 'home.nearbyCount').replace('{count}', String(nearbyCount))
            : t(locale, 'home.nearbyCountry').replace('{country}', localizeCountry(locale, country))}</Text>
        </View>
        <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor={Palette.textSecondary} />
      </Pressable>

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
      <View style={styles.heroIcon}>
        <AppIcon name={{ ios: 'arrow.triangle.branch', android: 'alt_route', web: 'alt_route' }} size={22} tintColor={Palette.white} />
      </View>
      <Text style={styles.heroEyebrow}>{t(locale, 'home.nextStep')}</Text>
      <Text style={styles.heroTitle}>{t(locale, `home.next.${actionKey}`)}</Text>
      {job && <Text numberOfLines={2} style={styles.heroTarget}>{job.title} · {job.company}</Text>}
      <View style={styles.heroAction}>
        <Text style={styles.heroActionText}>{t(locale, 'home.continue')}</Text>
        <AppIcon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={17} tintColor={Palette.white} />
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
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 14, gap: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: Palette.blue, fontSize: 13, lineHeight: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: Palette.text, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  roundButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  search: { minHeight: 56, borderRadius: Radius.medium, borderCurve: 'continuous', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  searchText: { flex: 1, color: Palette.textSecondary, fontSize: 16 },
  hero: { minHeight: 224, borderRadius: 28, borderCurve: 'continuous', padding: 22, backgroundColor: Palette.blue, overflow: 'hidden' },
  heroPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  heroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 18 },
  heroEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: Palette.white, fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  heroTarget: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 7 },
  heroAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  heroActionText: { color: Palette.white, fontSize: 15, fontWeight: '800' },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { flex: 1, color: Palette.text, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.4 },
  sectionAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  sectionActionText: { color: Palette.blue, fontSize: 14, fontWeight: '800' },
  cardRail: { gap: 12, paddingRight: 18, paddingBottom: 4 },
  inlineState: { minHeight: 120, borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 22 },
  inlineBody: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inlineButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  inlineButtonText: { color: Palette.blue, fontSize: 14, fontWeight: '800' },
  nearbyCard: { minHeight: 112, borderRadius: Radius.large, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Palette.white },
  nearbyIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  nearbyCopy: { flex: 1, minWidth: 0, gap: 4 },
  nearbyTitle: { color: Palette.text, fontSize: 17, fontWeight: '900' },
  nearbyBody: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
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
