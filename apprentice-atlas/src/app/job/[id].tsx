import { useCallback, useEffect, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiExplanation } from '@/components/jobs/ai-explanation';
import { JobQa } from '@/components/jobs/job-qa';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { explainJob } from '@/lib/ai';
import { getApplicationForJob, getReadableApplicationsError, type ApplicationsError } from '@/lib/applications';
import { isValidApplicationJobId } from '@/lib/application-flow';
import { getDescriptionLineLimit, prepareJobDescription } from '@/lib/discovery-presentation';
import { addFavorite, getFavoriteForJob, getReadableFavoritesError, removeFavorite, rollbackFavoriteState, type FavoritesError } from '@/lib/favorites';
import { localizeApplicationStatus, localizeCategory, localizeCountry, localizeJobLevel, localizeJobType, t, useLocale } from '@/lib/i18n';
import { getOriginalListingUrl, resetJobDetailState, type JobDetailState } from '@/lib/job-detail-state';
import { getJob } from '@/lib/jobs';
import { getValidHttpUrl } from '@/lib/official-listing-url';
import type { FavoriteJob, TrackedApplication } from '@/types/jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = String(id);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [locale] = useLocale();
  const auth = useAuth();
  const [state, setState] = useState<JobDetailState>({ job: null, explanation: null, loading: true, aiLoading: false, error: null, aiError: null });
  const [loadedId, setLoadedId] = useState(routeId);
  const [favorite, setFavorite] = useState<FavoriteJob | null>(null);
  const [favoriteJobId, setFavoriteJobId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState<FavoritesError | null>(null);
  const [application, setApplication] = useState<TrackedApplication | null>(null);
  const [applicationJobId, setApplicationJobId] = useState<string | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationError, setApplicationError] = useState<ApplicationsError | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const activeState = loadedId === routeId ? state : resetJobDetailState(state);
  const { job, explanation, loading, aiLoading, error, aiError } = activeState;
  const sessionKey = auth.session ? `${auth.session.user.id}:${auth.session.access_token}` : null;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const result = await getJob(routeId, undefined, locale);
      if (!mounted) return;
      setLoadedId(routeId);
      if (result.error || !result.data) setState((current) => ({ ...current, loading: false, error: result.error?.message ?? t(locale, 'errors.jobNotFound') }));
      else {
        setState((current) => ({ ...current, job: result.data, aiLoading: true, loading: false, error: null, aiError: null, explanation: null }));
        const ai = await explainJob(result.data.id, locale);
        if (mounted) setState((current) => ({ ...current, explanation: ai.data, aiError: ai.error ? t(locale, 'errors.aiUnavailable') : null, aiLoading: false }));
      }
    })();
    return () => { mounted = false; };
  }, [routeId, locale]);

  useEffect(() => {
    if (!auth.session || !job) return;
    let mounted = true;
    void getFavoriteForJob(job.id).then((result) => { if (mounted) { setFavoriteJobId(job.id); setFavorite(result.data); setFavoriteError(result.error); } });
    return () => { mounted = false; };
  }, [auth.session, job]);

  const loadApplication = useCallback(() => {
    if (auth.loading || !sessionKey || !job) {
      if (!auth.loading && !sessionKey) {
        setApplication(null);
        setApplicationJobId(null);
        setApplicationError(null);
        setApplicationLoading(false);
      }
      return undefined;
    }
    let active = true;
    const requestedJobId = job.id;
    setApplicationLoading(true);
    setApplicationError(null);
    void getApplicationForJob(requestedJobId).then((result) => {
      if (!active) return;
      setApplicationJobId(requestedJobId);
      setApplication(result.data);
      setApplicationError(result.error);
      setApplicationLoading(false);
    });
    return () => { active = false; };
  }, [auth.loading, job, sessionKey]);

  useFocusEffect(loadApplication);

  const activeFavorite = auth.session && favoriteJobId === job?.id ? favorite : null;
  const activeApplication = auth.session && applicationJobId === job?.id ? application : null;
  const toggleFavorite = async () => {
    if (!job || favoriteBusy) return;
    if (!auth.session) { router.push({ pathname: '/auth', params: { returnTo: `/job/${job.id}`, pendingAction: 'save', jobId: job.id } }); return; }
    const previous = activeFavorite;
    setFavoriteJobId(job.id); setFavoriteBusy(true); setFavoriteError(null);
    if (activeFavorite) {
      setFavorite(null);
      const result = await removeFavorite(job.id);
      if (result.error) { setFavorite(rollbackFavoriteState(previous)); setFavoriteError(result.error); }
    } else {
      const optimistic = { id: `optimistic-${job.id}`, userId: auth.session.user.id, jobId: job.id, createdAt: new Date().toISOString(), job };
      setFavorite(optimistic);
      const result = await addFavorite(job.id);
      if (result.error) { setFavorite(rollbackFavoriteState(previous)); setFavoriteError(result.error); }
      else setFavorite(result.data ?? optimistic);
    }
    setFavoriteBusy(false);
  };

  const openApplicationJourney = () => {
    if (!job || !isValidApplicationJobId(job.id)) return;
    if (!auth.session) {
      router.push({ pathname: '/auth', params: { returnTo: `/job/${job.id}`, pendingAction: 'track', jobId: job.id } });
      return;
    }
    router.push({ pathname: '/application/[jobId]', params: { jobId: job.id } } as never);
  };

  if (loading) return <State text={t(locale, 'loading.jobDetails')} locale={locale} />;
  if (error || !job) return <State text={error ?? t(locale, 'errors.jobNotFound')} locale={locale} back={() => router.back()} />;
  const sourceUrl = getOriginalListingUrl(job);
  const applicationUrl = getValidHttpUrl(job.applicationUrl);
  const primaryUrl = applicationUrl ?? sourceUrl;
  const primaryLabel = applicationUrl ? t(locale, 'actions.apply') : t(locale, 'job.openSourceShort');
  const compactActions = width < 360;
  const originalListing = prepareJobDescription(job.rawDescription || t(locale, 'ai.unknown'));
  const descriptionLineLimit = getDescriptionLineLimit(originalListing.collapsible, descriptionExpanded);
  const shareJob = () => void Share.share({ title: job.title, message: `${job.title} — ${job.company}\n${applicationUrl ?? sourceUrl ?? ''}` });

  return (
    <>
      <ScrollView style={styles.safe} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <Text style={styles.jobType}>{localizeJobType(locale, job.jobType)} · {localizeJobLevel(locale, job.level)}</Text>
          <Text selectable style={styles.title}>{job.title}</Text>
          <Text selectable style={styles.company}>{job.company}</Text>
          <View style={styles.heroLocation}><AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={16} tintColor={Palette.textSecondary} /><Text style={styles.heroLocationText}>{job.city}, {localizeCountry(locale, job.country)}</Text></View>
        </View>

        <Text style={styles.factsHeading}>{t(locale, 'job.atAGlance')}</Text>
        <View style={styles.facts}>
          <JobFact icon={{ ios: 'square.grid.2x2.fill', android: 'category', web: 'category' }} value={localizeCategory(locale, job.category)} />
          <JobFact icon={{ ios: 'figure.wave', android: 'school', web: 'school' }} value={localizeJobLevel(locale, job.level)} />
          {job.expiresAt && <JobFact icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} label={t(locale, 'job.closingDate')} value={new Date(job.expiresAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: 'short' })} />}
        </View>

        {favoriteError && <Text accessibilityRole="alert" style={styles.error}>{getReadableFavoritesError(favoriteError, locale, activeFavorite ? 'remove' : 'save')}</Text>}

        {process.env.EXPO_OS !== 'ios' && <View style={styles.utilityRow}><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.share')} onPress={shareJob} style={styles.utilityButton}><AppIcon name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={19} tintColor={Palette.blue} /></Pressable></View>}

        {primaryUrl && <View style={styles.topActions}>
          <Pressable accessibilityRole="link" accessibilityLabel={primaryLabel} onPress={() => void Linking.openURL(primaryUrl)} style={({ pressed }) => [styles.topPrimary, pressed && styles.pressed]}><Text style={styles.topPrimaryText}>{primaryLabel}</Text><AppIcon name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }} size={17} tintColor={Palette.white} /></Pressable>
          {sourceUrl && sourceUrl !== primaryUrl && <Pressable accessibilityRole="link" accessibilityLabel={t(locale, 'job.officialSource')} onPress={() => void Linking.openURL(sourceUrl)} style={({ pressed }) => [styles.topSecondary, pressed && styles.pressed]}><Text style={styles.topSecondaryText}>{t(locale, 'job.officialSource')}</Text></Pressable>}
        </View>}

        <View style={styles.source}><AppIcon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={19} tintColor={Palette.blue} /><View style={styles.sourceCopy}><Text style={styles.sourceText}>{job.sourceName}</Text><Text style={styles.updated}>{t(locale, 'job.lastUpdated')}: {new Date(job.updatedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text></View></View>

        <Pressable
          accessibilityLabel={`${t(locale, 'application.journey')}, ${activeApplication ? localizeApplicationStatus(locale, activeApplication.status) : t(locale, 'application.track')}`}
          accessibilityRole="button"
          onPress={openApplicationJourney}
          style={({ pressed }) => [styles.applicationJourney, pressed && styles.pressed]}
        >
          <View style={styles.applicationJourneyIcon}><AppIcon name={{ ios: 'arrow.trianglehead.branch', android: 'route', web: 'route' }} size={20} tintColor={Palette.blue} /></View>
          <View style={styles.applicationJourneyCopy}>
            <Text style={styles.applicationJourneyLabel}>{t(locale, 'application.journey')}</Text>
            <Text style={styles.applicationJourneyValue}>{applicationLoading && auth.session
              ? t(locale, 'application.loading')
              : activeApplication
                ? localizeApplicationStatus(locale, activeApplication.status)
                : t(locale, 'application.track')}</Text>
          </View>
          <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={Palette.textSecondary} />
        </Pressable>
        {applicationError && applicationJobId === job.id && <Text accessibilityRole="alert" style={styles.error}>{getReadableApplicationsError(applicationError, locale, 'load')}</Text>}

        <AiExplanation explanation={explanation} loading={aiLoading} error={aiError} />
        <JobQa jobId={job.id} />
        <View style={styles.originalSection}>
          <Text style={styles.heading}>{t(locale, 'job.originalListing')}</Text>
          <Text selectable style={styles.body} {...(descriptionLineLimit ? { numberOfLines: descriptionLineLimit } : {})}>{originalListing.text}</Text>
          {originalListing.collapsible && <Pressable accessibilityRole="button" accessibilityState={{ expanded: descriptionExpanded }} onPress={() => setDescriptionExpanded((value) => !value)} style={styles.showMore}><Text style={styles.showMoreText}>{t(locale, descriptionExpanded ? 'job.showLess' : 'job.showMore')}</Text><AppIcon name={{ ios: descriptionExpanded ? 'chevron.up' : 'chevron.down', android: descriptionExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down', web: descriptionExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }} size={18} tintColor={Palette.blue} /></Pressable>}
          {job.requirements.length > 0 && <View style={styles.requirements}><Text style={styles.requirementsHeading}>{t(locale, 'job.requirements')}</Text>{job.requirements.map((item) => <View key={item} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{item}</Text></View>)}</View>}
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBarSafe}>
        <View style={styles.bottomBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={activeFavorite ? t(locale, 'actions.saved') : t(locale, 'actions.save')} accessibilityState={{ selected: Boolean(activeFavorite), disabled: favoriteBusy }} disabled={favoriteBusy} onPress={() => void toggleFavorite()} style={({ pressed }) => [styles.bottomSave, compactActions && styles.bottomSaveCompact, !primaryUrl && styles.bottomSaveOnly, pressed && styles.pressed]}>
            <AppIcon name={activeFavorite ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={20} tintColor={Palette.blue} />
            {!compactActions && <Text style={styles.bottomSaveText}>{activeFavorite ? t(locale, 'actions.saved') : t(locale, 'actions.save')}</Text>}
          </Pressable>
          {primaryUrl && <Pressable accessibilityRole="link" accessibilityLabel={primaryLabel} onPress={() => void Linking.openURL(primaryUrl)} style={({ pressed }) => [styles.bottomPrimary, pressed && styles.pressed]}>
            <Text style={styles.bottomPrimaryText}>{primaryLabel}</Text>
            <AppIcon name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }} size={17} tintColor={Palette.white} />
          </Pressable>}
        </View>
      </SafeAreaView>
      <Stack.Screen options={{ title: '', headerShown: true, headerTransparent: false, headerStyle: { backgroundColor: Palette.white }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }} />
      {process.env.EXPO_OS === 'ios' && <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="square.and.arrow.up" onPress={shareJob} /></Stack.Toolbar>}
    </>
  );
}

function JobFact({ icon, label, value }: { icon: AppIconName; label?: string; value: string }) {
  return <View style={styles.fact}><AppIcon name={icon} size={17} tintColor={Palette.blue} /><View style={styles.factCopy}>{label && <Text style={styles.factLabel}>{label}</Text>}<Text style={styles.factValue} numberOfLines={2}>{value}</Text></View></View>;
}

function State({ text, back, locale }: { text: string; back?: () => void; locale: 'de' | 'en' }) {
  return <View style={styles.state}><View style={styles.stateIcon}><AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={26} tintColor={Palette.blue} /></View><Text accessibilityRole="alert" style={styles.stateText}>{text}</Text>{back && <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.back')} onPress={back} style={styles.stateButton}><Text style={styles.sourceLinkText}>{t(locale, 'actions.back')}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.white },
  content: { maxWidth: 720, width: '100%', alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 120 },
  hero: { paddingTop: 8, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  jobType: { color: Palette.textSecondary, fontSize: 14, marginBottom: 7 },
  title: { color: Palette.text, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  company: { color: Palette.text, fontSize: 17, fontWeight: '600', marginTop: 9 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  heroLocationText: { color: Palette.textSecondary, fontSize: 14 },
  factsHeading: { color: Palette.text, fontSize: 15, fontWeight: '700', paddingTop: 18 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 8 },
  fact: { flexGrow: 1, flexBasis: 104, minHeight: 56, minWidth: 104, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: Palette.border },
  factCopy: { flex: 1, minWidth: 0 },
  factLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 2 },
  factValue: { color: Palette.text, fontSize: 13, lineHeight: 17, fontWeight: '600' },
  error: { color: Palette.danger, marginTop: 12, fontWeight: '700' },
  utilityRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 12 },
  utilityButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', gap: 9, paddingTop: 16 },
  topPrimary: { flex: 1, minHeight: 50, borderRadius: 14, borderCurve: 'continuous', backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  topPrimaryText: { color: Palette.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  topSecondary: { flex: 1, minHeight: 50, borderRadius: 14, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  topSecondaryText: { color: Palette.blue, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sourceLinkText: { color: Palette.blue, fontWeight: '700' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, marginTop: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  sourceCopy: { flex: 1 },
  sourceText: { color: Palette.text, fontWeight: '600' },
  updated: { color: Palette.textSecondary, marginTop: 4, fontSize: 13 },
  applicationJourney: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderCurve: 'continuous', backgroundColor: Palette.blueSoft },
  applicationJourneyIcon: { width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  applicationJourneyCopy: { flex: 1, minWidth: 0, gap: 2 },
  applicationJourneyLabel: { color: Palette.text, fontSize: 14, fontWeight: '700' },
  applicationJourneyValue: { color: Palette.blue, fontSize: 13, fontWeight: '600' },
  originalSection: { paddingTop: 30, marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  heading: { color: Palette.text, fontWeight: '700', fontSize: 21 },
  body: { color: Palette.text, lineHeight: 23, marginTop: 10, fontSize: 15 },
  showMore: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  showMoreText: { color: Palette.blue, fontSize: 14, fontWeight: '700' },
  requirements: { paddingTop: 22 },
  requirementsHeading: { color: Palette.text, fontWeight: '700', fontSize: 18 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.blue, marginTop: 7 },
  bulletText: { flex: 1, color: Palette.text, fontSize: 15, lineHeight: 22 },
  bottomBarSafe: { backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border, boxShadow: '0 -6px 22px rgba(15, 23, 42, 0.08)' },
  bottomBar: { width: '100%', maxWidth: 720, minHeight: 72, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  bottomSave: { minWidth: 116, minHeight: 50, borderRadius: 14, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14 },
  bottomSaveCompact: { width: 50, minWidth: 50, paddingHorizontal: 0 },
  bottomSaveOnly: { flex: 1 },
  bottomSaveText: { color: Palette.blue, fontSize: 15, fontWeight: '700' },
  bottomPrimary: { flex: 1, minHeight: 50, borderRadius: 14, borderCurve: 'continuous', backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  bottomPrimaryText: { flexShrink: 1, color: Palette.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  state: { flex: 1, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  stateIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stateText: { color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 },
  stateButton: { minHeight: 44, borderRadius: 12, backgroundColor: Palette.blueSoft, paddingHorizontal: 18, justifyContent: 'center' },
});
