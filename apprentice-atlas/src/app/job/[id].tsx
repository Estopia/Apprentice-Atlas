import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AiExplanation } from '@/components/jobs/ai-explanation';
import { JobQa } from '@/components/jobs/job-qa';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { explainJob } from '@/lib/ai';
import { addFavorite, getFavoriteForJob, getReadableFavoritesError, removeFavorite, rollbackFavoriteState, type FavoritesError } from '@/lib/favorites';
import { localizeCategory, localizeCountry, localizeJobLevel, localizeJobType, t, useLocale } from '@/lib/i18n';
import { getOriginalListingUrl, resetJobDetailState, type JobDetailState } from '@/lib/job-detail-state';
import { getJob } from '@/lib/jobs';
import { getValidHttpUrl } from '@/lib/official-listing-url';
import type { FavoriteJob } from '@/types/jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = String(id);
  const router = useRouter();
  const [locale] = useLocale();
  const auth = useAuth();
  const [state, setState] = useState<JobDetailState>({ job: null, explanation: null, loading: true, aiLoading: false, error: null, aiError: null });
  const [loadedId, setLoadedId] = useState(routeId);
  const [favorite, setFavorite] = useState<FavoriteJob | null>(null);
  const [favoriteJobId, setFavoriteJobId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState<FavoritesError | null>(null);
  const activeState = loadedId === routeId ? state : resetJobDetailState(state);
  const { job, explanation, loading, aiLoading, error, aiError } = activeState;

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

  const activeFavorite = auth.session && favoriteJobId === job?.id ? favorite : null;
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

  if (loading) return <State text={t(locale, 'loading.jobDetails')} locale={locale} />;
  if (error || !job) return <State text={error ?? t(locale, 'errors.jobNotFound')} locale={locale} back={() => router.back()} />;
  const sourceUrl = getOriginalListingUrl(job);
  const applicationUrl = getValidHttpUrl(job.applicationUrl);
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

        <View style={styles.facts}>
          <JobFact icon={{ ios: 'square.grid.2x2.fill', android: 'category', web: 'category' }} value={localizeCategory(locale, job.category)} />
          <JobFact icon={{ ios: 'figure.wave', android: 'school', web: 'school' }} value={localizeJobLevel(locale, job.level)} />
          {job.expiresAt && <JobFact icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} label={t(locale, 'job.closingDate')} value={new Date(job.expiresAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: 'short' })} />}
        </View>

        {favoriteError && <Text accessibilityRole="alert" style={styles.error}>{getReadableFavoritesError(favoriteError, locale, activeFavorite ? 'remove' : 'save')}</Text>}

        {process.env.EXPO_OS !== 'ios' && <View style={styles.utilityRow}><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.share')} onPress={shareJob} style={styles.utilityButton}><AppIcon name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={19} tintColor={Palette.blue} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={activeFavorite ? t(locale, 'actions.saved') : t(locale, 'actions.save')} onPress={() => void toggleFavorite()} style={styles.utilityButton}><AppIcon name={activeFavorite ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={19} tintColor={Palette.blue} /></Pressable></View>}

        <View style={styles.actionRow}>
          {applicationUrl && <Pressable accessibilityRole="link" accessibilityLabel={t(locale, 'actions.apply')} onPress={() => void Linking.openURL(applicationUrl)} style={styles.apply}><Text style={styles.applyText}>{t(locale, 'actions.apply')}</Text><AppIcon name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }} size={17} tintColor={Palette.white} /></Pressable>}
          {sourceUrl && <Pressable accessibilityRole="link" accessibilityLabel={t(locale, 'job.openSource')} onPress={() => void Linking.openURL(sourceUrl)} style={styles.sourceLink}><Text style={styles.sourceLinkText}>{t(locale, 'job.openSource')}</Text></Pressable>}
        </View>

        <View style={styles.source}><AppIcon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={19} tintColor={Palette.blue} /><View style={styles.sourceCopy}><Text style={styles.sourceText}>{job.sourceName}</Text><Text style={styles.updated}>{t(locale, 'job.lastUpdated')}: {new Date(job.updatedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text></View></View>

        <AiExplanation explanation={explanation} loading={aiLoading} error={aiError} />
        <View style={styles.section}><Text style={styles.heading}>{t(locale, 'job.description')}</Text><Text style={styles.body}>{job.rawDescription || t(locale, 'ai.unknown')}</Text></View>
        {job.requirements.length > 0 && <View style={styles.section}><Text style={styles.heading}>{t(locale, 'job.requirements')}</Text>{job.requirements.map((item) => <View key={item} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{item}</Text></View>)}</View>}
        <JobQa jobId={job.id} />
      </ScrollView>
      <Stack.Screen options={{ title: '', headerShown: true, headerTransparent: true, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }} />
      {process.env.EXPO_OS === 'ios' && <Stack.Toolbar placement="right"><Stack.Toolbar.Button icon="square.and.arrow.up" onPress={shareJob} /><Stack.Toolbar.Button icon={activeFavorite ? 'bookmark.fill' : 'bookmark'} selected={Boolean(activeFavorite)} disabled={favoriteBusy} onPress={() => void toggleFavorite()} /></Stack.Toolbar>}
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
  safe: { flex: 1, backgroundColor: Palette.background },
  content: { maxWidth: 720, width: '100%', alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 120 },
  hero: { paddingTop: 14, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  jobType: { color: Palette.textSecondary, fontSize: 14, marginBottom: 7 },
  title: { color: Palette.text, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  company: { color: Palette.text, fontSize: 17, fontWeight: '600', marginTop: 9 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  heroLocationText: { color: Palette.textSecondary, fontSize: 14 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 14 },
  fact: { flexGrow: 1, flexBasis: 100, minHeight: 62, minWidth: 100, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 14, borderCurve: 'continuous', backgroundColor: Palette.surface },
  factCopy: { flex: 1, minWidth: 0 },
  factLabel: { color: Palette.textSecondary, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  factValue: { color: Palette.text, fontSize: 12, lineHeight: 15, fontWeight: '600' },
  error: { color: Palette.danger, marginTop: 12, fontWeight: '700' },
  utilityRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 12 },
  utilityButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 16 },
  apply: { minHeight: 50, flexGrow: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 18, backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyText: { color: Palette.white, fontWeight: '700', fontSize: 16 },
  sourceLink: { minHeight: 50, flexGrow: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 18, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  sourceLinkText: { color: Palette.blue, fontWeight: '700' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, marginTop: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  sourceCopy: { flex: 1 },
  sourceText: { color: Palette.text, fontWeight: '600' },
  updated: { color: Palette.textSecondary, marginTop: 4, fontSize: 11 },
  section: { paddingTop: 24 },
  heading: { color: Palette.text, fontWeight: '700', fontSize: 21 },
  body: { color: Palette.text, lineHeight: 23, marginTop: 10, fontSize: 15 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.blue, marginTop: 7 },
  bulletText: { flex: 1, color: Palette.text, lineHeight: 22 },
  state: { flex: 1, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  stateIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stateText: { color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 },
  stateButton: { minHeight: 44, borderRadius: 12, backgroundColor: Palette.blueSoft, paddingHorizontal: 18, justifyContent: 'center' },
});
