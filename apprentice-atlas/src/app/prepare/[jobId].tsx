import { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { prepareForJob } from '@/lib/ai';
import {
  CAREER_PROFILE_MAX_LENGTH,
  getIdentityScopedPreparationState,
  loadCareerProfile,
  saveCareerProfile,
  type IdentityScopedPreparationState,
} from '@/lib/career-profile';
import { t, useLocale, type Locale } from '@/lib/i18n';
import type { JobPreparation } from '@/types/jobs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PrepareScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const routeJobId = String(jobId);
  const validJobId = UUID_PATTERN.test(routeJobId);
  const router = useRouter();
  const [locale] = useLocale();
  const auth = useAuth();
  const [personalState, setPersonalState] = useState<IdentityScopedPreparationState<JobPreparation> | null>(null);
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const userId = auth.session?.user.id ?? null;
  const { background, error, generating, result, saveError } = getIdentityScopedPreparationState(personalState, userId);
  const profileLoading = Boolean(userId && loadedForUser !== userId);
  const generateDisabled = profileLoading || generating || !validJobId || background.trim().length < 10;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadCareerProfile(userId).then((profile) => {
      if (!active) return;
      setPersonalState((current) => ({
        ...getIdentityScopedPreparationState(current, userId),
        background: profile,
      }));
      setLoadedForUser(userId);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId || loadedForUser !== userId) return;
    const timer = setTimeout(() => {
      void saveCareerProfile(userId, background)
        .then(() => setPersonalState((current) => current?.userId === userId ? { ...current, saveError: false } : current))
        .catch(() => setPersonalState((current) => current?.userId === userId ? { ...current, saveError: true } : current));
    }, 250);
    return () => clearTimeout(timer);
  }, [background, loadedForUser, userId]);

  const generate = async () => {
    if (generateDisabled || !userId) return;
    const requestUserId = userId;
    const requestBackground = background.trim();
    setPersonalState((current) => ({
      ...getIdentityScopedPreparationState(current, requestUserId),
      generating: true,
      error: null,
    }));
    const response = await prepareForJob(routeJobId, locale, requestBackground);
    setPersonalState((current) => {
      if (!current || current.userId !== requestUserId) return current;
      return response.error || !response.data
        ? { ...current, generating: false, error: t(locale, 'prepare.error') }
        : { ...current, generating: false, result: response.data, error: null };
    });
  };

  const updateBackground = (value: string) => {
    setPersonalState((current) => ({
      ...getIdentityScopedPreparationState(current, userId),
      background: value,
      result: null,
      error: null,
    }));
  };

  const signIn = () => router.push({ pathname: '/auth', params: { returnTo: `/prepare/${routeJobId}` } });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <Stack.Screen options={{ title: t(locale, 'prepare.screenTitle'), headerStyle: { backgroundColor: Palette.white }, headerTintColor: Palette.text }} />
      {auth.loading ? (
        <ScreenState loading message={t(locale, 'prepare.loadingProfile')} />
      ) : !validJobId ? (
        <ScreenState message={t(locale, 'prepare.invalidJob')} />
      ) : !auth.session ? (
        <View style={styles.authState}>
          <View style={styles.stateIcon}><AppIcon name={{ ios: 'lock.shield.fill', android: 'shield', web: 'lock' }} size={26} tintColor={Palette.blue} /></View>
          <Text style={styles.stateTitle}>{t(locale, 'prepare.authTitle')}</Text>
          <Text style={styles.stateBody}>{t(locale, 'prepare.authBody')}</Text>
          <Pressable accessibilityRole="button" onPress={signIn} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{t(locale, 'prepare.authAction')}</Text>
          </Pressable>
        </View>
      ) : profileLoading ? (
        <ScreenState loading message={t(locale, 'prepare.loadingProfile')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroIcon}><AppIcon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={24} tintColor={Palette.blue} /></View>
            <Text style={styles.title}>{t(locale, 'prepare.title')}</Text>
            <Text style={styles.subtitle}>{t(locale, 'prepare.subtitle')}</Text>
          </View>

          <View style={styles.privacyNote}>
            <AppIcon name={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }} size={18} tintColor={Palette.blue} />
            <Text style={styles.privacyText}>{t(locale, 'prepare.privateNote')}</Text>
          </View>

          <View style={styles.editorSection}>
            <Text style={styles.sectionLabel}>{t(locale, 'prepare.backgroundLabel')}</Text>
            <TextInput
              accessibilityLabel={t(locale, 'prepare.backgroundLabel')}
              accessibilityHint={t(locale, 'prepare.backgroundHint')}
              maxLength={CAREER_PROFILE_MAX_LENGTH}
              multiline
              onChangeText={updateBackground}
              placeholder={t(locale, 'prepare.backgroundPlaceholder')}
              placeholderTextColor={Palette.textSecondary}
              style={styles.input}
              textAlignVertical="top"
              value={background}
            />
            <View style={styles.editorMeta}>
              <Text style={styles.hint}>{t(locale, 'prepare.backgroundHint')}</Text>
              <Text accessibilityLabel={`${background.length} / ${CAREER_PROFILE_MAX_LENGTH}`} style={styles.count}>{background.length}/{CAREER_PROFILE_MAX_LENGTH}</Text>
            </View>
            {saveError && <Text accessibilityRole="alert" style={styles.errorText}>{t(locale, 'prepare.saveError')}</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: generateDisabled, busy: generating }}
              disabled={generateDisabled}
              onPress={() => void generate()}
              style={({ pressed }) => [styles.generateButton, generateDisabled && styles.disabledButton, pressed && !generateDisabled && styles.pressed]}
            >
              {generating ? <ActivityIndicator color={Palette.white} size="small" /> : <AppIcon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={18} tintColor={Palette.white} />}
              <Text style={styles.generateButtonText}>{t(locale, generating ? 'prepare.generating' : 'prepare.generate')}</Text>
            </Pressable>
          </View>

          {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorBanner}>{error}</Text>}

          {generating ? (
            <View accessibilityLiveRegion="polite" style={styles.loadingCard}>
              <ActivityIndicator accessibilityLabel={t(locale, 'prepare.generating')} color={Palette.blue} size="small" />
              <Text style={styles.loadingText}>{t(locale, 'prepare.generating')}</Text>
            </View>
          ) : result ? (
            <PreparationResult locale={locale} result={result} />
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><AppIcon name={{ ios: 'text.bubble', android: 'forum', web: 'forum' }} size={23} tintColor={Palette.blue} /></View>
              <Text style={styles.emptyTitle}>{t(locale, 'prepare.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t(locale, 'prepare.emptyBody')}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function PreparationResult({ locale, result }: { locale: Locale; result: JobPreparation }) {
  return (
    <View style={styles.results}>
      <View style={styles.resultHeading}>
        <Text accessibilityRole="header" style={styles.resultTitle}>{t(locale, 'prepare.interviewTitle')}</Text>
        <Text style={styles.resultCount}>{result.interviewQuestions.length}</Text>
      </View>
      {result.interviewQuestions.map((item, index) => (
        <View key={`${index}-${item.question}`} style={styles.questionCard}>
          <View style={styles.questionNumber}><Text style={styles.questionNumberText}>{index + 1}</Text></View>
          <Text selectable style={styles.questionText}>{item.question}</Text>
          <View style={styles.coachingBlock}>
            <Text style={styles.coachingLabel}>{t(locale, 'prepare.questionWhy')}</Text>
            <Text selectable style={styles.coachingText}>{item.whyAsked}</Text>
          </View>
          <View style={[styles.coachingBlock, styles.tipBlock]}>
            <Text style={styles.coachingLabel}>{t(locale, 'prepare.answerTip')}</Text>
            <Text selectable style={styles.coachingText}>{item.answerTip}</Text>
          </View>
        </View>
      ))}

      <Text accessibilityRole="header" style={[styles.resultTitle, styles.skillGapTitle]}>{t(locale, 'prepare.skillGapTitle')}</Text>
      <ListSection empty={t(locale, 'prepare.noMatches')} items={result.skillGap.matches} tone="positive" title={t(locale, 'prepare.matchesTitle')} />
      <ListSection empty={t(locale, 'prepare.noGaps')} items={result.skillGap.gaps} tone="growth" title={t(locale, 'prepare.gapsTitle')} />
      <ListSection empty={t(locale, 'prepare.noPositioning')} items={result.skillGap.positioningTips} tone="neutral" title={t(locale, 'prepare.positioningTitle')} />

      <View style={styles.uncertainty}>
        <AppIcon name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={19} tintColor={Palette.blue} />
        <Text style={styles.uncertaintyText}>{t(locale, 'prepare.uncertainty')}</Text>
      </View>
    </View>
  );
}

function ListSection({ empty, items, tone, title }: { empty: string; items: string[]; tone: 'positive' | 'growth' | 'neutral'; title: string }) {
  return (
    <View style={styles.listCard}>
      <View style={[styles.listMarker, tone === 'positive' ? styles.positiveMarker : tone === 'growth' ? styles.growthMarker : styles.neutralMarker]} />
      <View style={styles.listContent}>
        <Text style={styles.listTitle}>{title}</Text>
        {(items.length ? items : [empty]).map((item, index) => (
          <View key={`${index}-${item}`} style={styles.listRow}>
            <View style={styles.bullet} />
            <Text selectable style={[styles.listText, items.length === 0 && styles.mutedText]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScreenState({ loading, message }: { loading?: boolean; message: string }) {
  return (
    <View style={styles.authState}>
      {loading ? <ActivityIndicator accessibilityLabel={message} color={Palette.blue} /> : <View style={styles.stateIcon}><AppIcon name={{ ios: 'exclamationmark', android: 'error', web: 'error' }} size={24} tintColor={Palette.blue} /></View>}
      <Text accessibilityRole={loading ? undefined : 'alert'} style={styles.stateBody}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 72, gap: 20 },
  hero: { alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingBottom: 4 },
  heroIcon: { width: 52, height: 52, borderRadius: 17, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft, marginBottom: 4 },
  title: { color: Palette.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { maxWidth: 520, color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: Radius.small, backgroundColor: Palette.blueSoft },
  privacyText: { flex: 1, color: Palette.blueDark, fontSize: 13, lineHeight: 19 },
  editorSection: { gap: 9 },
  sectionLabel: { color: Palette.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  input: { minHeight: 148, maxHeight: 260, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.medium, color: Palette.text, backgroundColor: Palette.surface, fontSize: 16, lineHeight: 23 },
  editorMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hint: { flex: 1, color: Palette.textSecondary, fontSize: 12, lineHeight: 17 },
  count: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, fontVariant: ['tabular-nums'] },
  errorText: { color: Palette.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  generateButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, backgroundColor: Palette.blue, marginTop: 3 },
  generateButtonText: { color: Palette.white, fontSize: 16, fontWeight: '800' },
  disabledButton: { opacity: 0.45 },
  errorBanner: { color: Palette.danger, backgroundColor: '#FFF1F0', borderRadius: Radius.small, padding: 13, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  loadingCard: { minHeight: 126, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: Radius.medium, backgroundColor: Palette.surface },
  loadingText: { color: Palette.textSecondary, fontSize: 14 },
  emptyCard: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, borderRadius: Radius.medium, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  emptyIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft, marginBottom: 3 },
  emptyTitle: { color: Palette.text, fontSize: 18, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  emptyBody: { maxWidth: 430, color: Palette.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  results: { gap: 13, paddingTop: 4 },
  resultHeading: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9 },
  resultTitle: { flex: 1, color: Palette.text, fontSize: 21, lineHeight: 27, fontWeight: '800', letterSpacing: -0.25 },
  resultCount: { minWidth: 28, height: 28, borderRadius: 14, color: Palette.blue, backgroundColor: Palette.blueSoft, textAlign: 'center', lineHeight: 28, fontSize: 13, fontWeight: '800' },
  questionCard: { gap: 10, padding: 16, borderRadius: Radius.medium, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  questionNumber: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blue },
  questionNumberText: { color: Palette.white, fontSize: 13, fontWeight: '800' },
  questionText: { color: Palette.text, fontSize: 18, lineHeight: 25, fontWeight: '800' },
  coachingBlock: { gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  tipBlock: { padding: 11, borderTopWidth: 0, borderRadius: Radius.small, backgroundColor: Palette.blueSoft },
  coachingLabel: { color: Palette.blue, fontSize: 12, lineHeight: 17, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.35 },
  coachingText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21 },
  skillGapTitle: { marginTop: 10 },
  listCard: { overflow: 'hidden', flexDirection: 'row', borderRadius: Radius.medium, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  listMarker: { width: 5 },
  positiveMarker: { backgroundColor: Palette.success },
  growthMarker: { backgroundColor: Palette.coral },
  neutralMarker: { backgroundColor: Palette.blue },
  listContent: { flex: 1, gap: 9, padding: 15 },
  listTitle: { color: Palette.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.blue, marginTop: 7 },
  listText: { flex: 1, color: Palette.text, fontSize: 14, lineHeight: 21 },
  mutedText: { color: Palette.textSecondary },
  uncertainty: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: Radius.small, backgroundColor: Palette.surface },
  uncertaintyText: { flex: 1, color: Palette.textSecondary, fontSize: 13, lineHeight: 19 },
  authState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11, paddingHorizontal: 28 },
  stateIcon: { width: 56, height: 56, borderRadius: 18, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft, marginBottom: 3 },
  stateTitle: { color: Palette.text, fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  stateBody: { maxWidth: 420, color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 13, backgroundColor: Palette.blue, marginTop: 5 },
  primaryButtonText: { color: Palette.white, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
