import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiExplanation } from '@/components/jobs/ai-explanation';
import { JobQa } from '@/components/jobs/job-qa';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { explainJob } from '@/lib/ai';
import { addFavorite, getFavoriteForJob, getReadableFavoritesError, removeFavorite, rollbackFavoriteState, type FavoritesError } from '@/lib/favorites';
import { t, useLocale } from '@/lib/i18n';
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
        if (mounted) setState((current) => ({ ...current, explanation: ai.data, aiError: ai.error?.message ?? null, aiLoading: false }));
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
  const accent = job.category === 'technology' ? Palette.blue : job.category === 'business' ? Palette.coral : Palette.lime;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.back')} onPress={() => router.back()} style={styles.backButton}><AppIcon name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={20} tintColor={Palette.blueDark} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={activeFavorite ? t(locale, 'actions.saved') : favoriteBusy ? t(locale, 'actions.saving') : t(locale, 'actions.save')} accessibilityState={{ selected: Boolean(activeFavorite), disabled: favoriteBusy }} disabled={favoriteBusy} onPress={() => void toggleFavorite()} style={[styles.roundButton, activeFavorite && styles.roundButtonSaved]}><AppIcon name={activeFavorite ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }} size={20} tintColor={activeFavorite ? Palette.white : Palette.blueDark} /></Pressable>
        </View>

        <View style={[styles.hero, Shadows.floating]}>
          <View style={[styles.heroIcon, { backgroundColor: accent }]}><AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={28} tintColor={Palette.white} /></View>
          <Text style={styles.heroEyebrow}>{job.jobType} · {job.level}</Text>
          <Text style={styles.title}>{job.title.replace(/\s+-\s+/, '\n')}</Text>
          <Text style={styles.company}>{job.company}</Text>
          <View style={styles.heroLocation}><AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={17} tintColor="#BFD2FF" /><Text style={styles.heroLocationText}>{job.city}, {job.country}</Text></View>
        </View>

        {favoriteError && <Text accessibilityRole="alert" style={styles.error}>{getReadableFavoritesError(favoriteError, locale, activeFavorite ? 'remove' : 'save')}</Text>}

        <View style={styles.actionRow}>
          {applicationUrl && <Pressable accessibilityRole="link" accessibilityLabel={t(locale, 'actions.apply')} onPress={() => void Linking.openURL(applicationUrl)} style={styles.apply}><Text style={styles.applyText}>{t(locale, 'actions.apply')}</Text><AppIcon name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }} size={17} tintColor={Palette.white} /></Pressable>}
          {sourceUrl && <Pressable accessibilityRole="link" accessibilityLabel={t(locale, 'job.openSource')} onPress={() => void Linking.openURL(sourceUrl)} style={styles.sourceLink}><Text style={styles.sourceLinkText}>{t(locale, 'job.openSource')}</Text></Pressable>}
        </View>

        <View style={styles.source}><View style={styles.sourceIcon}><AppIcon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={20} tintColor={Palette.blue} /></View><View style={styles.sourceCopy}><Text style={styles.sourceText}>{job.sourceName}</Text><Text style={styles.updated}>{t(locale, 'job.lastUpdated')}: {new Date(job.updatedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB')}</Text></View></View>

        <View style={styles.section}><Text style={styles.heading}>{t(locale, 'job.description')}</Text><Text style={styles.body}>{job.rawDescription || t(locale, 'ai.unknown')}</Text></View>
        <View style={styles.section}><Text style={styles.heading}>{t(locale, 'job.requirements')}</Text>{job.requirements.length ? job.requirements.map((item) => <View key={item} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{item}</Text></View>) : <Text style={styles.body}>{t(locale, 'ai.unknown')}</Text>}</View>
        <AiExplanation explanation={explanation} loading={aiLoading} error={aiError} />
        <JobQa jobId={job.id} />
      </ScrollView>
    </SafeAreaView>
  );
}

function State({ text, back, locale }: { text: string; back?: () => void; locale: 'de' | 'en' }) {
  return <View style={styles.state}><View style={styles.stateIcon}><AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={26} tintColor={Palette.blue} /></View><Text accessibilityRole="alert" style={styles.stateText}>{text}</Text>{back && <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.back')} onPress={back} style={styles.stateButton}><Text style={styles.sourceLinkText}>{t(locale, 'actions.back')}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  content: { maxWidth: 760, width: '100%', alignSelf: 'center', padding: 16, paddingBottom: 120 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  backButton: { width: 46, height: 46, minHeight: 44, minWidth: 44, borderRadius: 23, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  roundButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  roundButtonSaved: { backgroundColor: Palette.blue },
  hero: { backgroundColor: Palette.blueDark, borderRadius: 28, padding: 22, overflow: 'hidden' },
  heroIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroEyebrow: { color: '#BFD2FF', fontSize: 11, lineHeight: 16, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Palette.white, fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 7 },
  company: { color: '#D7E2FA', fontSize: 17, fontWeight: '700', marginTop: 9 },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  heroLocationText: { color: '#BFD2FF', fontSize: 13, fontWeight: '700' },
  error: { color: Palette.danger, marginTop: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  apply: { minHeight: 52, flexGrow: 1, borderRadius: Radius.medium, paddingHorizontal: 18, backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyText: { color: Palette.white, fontWeight: '900', fontSize: 15 },
  sourceLink: { minHeight: 52, flexGrow: 1, borderRadius: Radius.medium, paddingHorizontal: 18, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  sourceLinkText: { color: Palette.blue, fontWeight: '900' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: Palette.surface, borderRadius: Radius.medium, padding: 14, marginTop: 16, borderWidth: 1, borderColor: Palette.border },
  sourceIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  sourceCopy: { flex: 1 },
  sourceText: { color: Palette.blueDark, fontWeight: '900' },
  updated: { color: Palette.textSecondary, marginTop: 4, fontSize: 11 },
  section: { marginTop: 24 },
  heading: { color: Palette.blueDark, fontWeight: '900', fontSize: 21 },
  body: { color: Palette.text, lineHeight: 23, marginTop: 10, fontSize: 15 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.blue, marginTop: 7 },
  bulletText: { flex: 1, color: Palette.text, lineHeight: 22 },
  state: { flex: 1, backgroundColor: Palette.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  stateIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stateText: { color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 },
  stateButton: { minHeight: 44, borderRadius: 15, backgroundColor: Palette.blueSoft, paddingHorizontal: 18, justifyContent: 'center' },
});
