import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';
import { localizeCategory, t } from '@/lib/i18n';
import { getPostOnboardingDestination } from '@/lib/onboarding-destination';
import type { UserPreferences } from '@/lib/preferences';

const TOTAL_STEPS = 3;
const INTERESTS = ['technology', 'business', 'skilled-trades', 'general'];

type Audience = NonNullable<UserPreferences['audience']>;
type Country = NonNullable<UserPreferences['country']>;

export default function OnboardingScreen() {
  const { preferences, isHydrated, completeOnboarding } = usePreferences();
  const continuationParams = useLocalSearchParams<{
    jobId?: string;
    pendingAction?: string;
    returnTo?: string;
  }>();
  if (!isHydrated) return null;
  return <OnboardingFlow complete={completeOnboarding} continuationParams={continuationParams} initialPreferences={preferences} />;
}

function OnboardingFlow({ complete, continuationParams, initialPreferences }: {
  complete: (preferences: UserPreferences) => Promise<UserPreferences>;
  continuationParams: { jobId?: string; pendingAction?: string; returnTo?: string };
  initialPreferences: UserPreferences;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(initialPreferences);
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const locale = draft.locale;
  const isValid = step === 0
    ? draft.country !== null
    : step === 1
      ? draft.audience !== null
      : draft.interests.length > 0;
  const isEditing = initialPreferences.onboardingComplete;

  const selectAudience = (audience: Audience) => setDraft((current) => ({ ...current, audience }));
  const selectCountry = (country: Country) => setDraft((current) => ({ ...current, country }));
  const toggleInterest = (interest: string) => setDraft((current) => ({
    ...current,
    interests: current.interests.includes(interest)
      ? current.interests.filter((value) => value !== interest)
      : [...current.interests, interest],
  }));

  const continueFlow = async () => {
    if (!isValid || isSaving) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1);
      return;
    }
    setIsSaving(true);
    await complete(draft);
    router.replace(getPostOnboardingDestination(continuationParams, isEditing) as never);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        {
          minHeight: height,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <AppIcon name={{ ios: 'map.fill', android: 'map', web: 'map' }} size={22} tintColor={Palette.white} />
          </View>
          <Text style={styles.eyebrow}>{t(locale, 'onboarding.eyebrow')}</Text>
          <Text style={styles.stepLabel}>{t(locale, 'onboarding.step')} {step + 1} {t(locale, 'onboarding.of')} {TOTAL_STEPS}</Text>
        </View>

        <View accessibilityLabel={`${t(locale, 'onboarding.step')} ${step + 1} ${t(locale, 'onboarding.of')} ${TOTAL_STEPS}`} style={styles.progress}>
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <View key={index} style={[styles.progressTrack, index <= step && styles.progressTrackActive]} />
          ))}
        </View>

        <View style={styles.content}>
          {step === 0 && (
            <StepHeading title={t(locale, 'onboarding.countryLanguageTitle')} description={t(locale, 'onboarding.countryLanguageDescription')}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t(locale, 'onboarding.language')}</Text>
                <View style={styles.languageControl}>
                  <LanguageChoice active={draft.locale === 'de'} label="Deutsch" onPress={() => setDraft((current) => ({ ...current, locale: 'de' }))} />
                  <LanguageChoice active={draft.locale === 'en'} label="English" onPress={() => setDraft((current) => ({ ...current, locale: 'en' }))} />
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t(locale, 'onboarding.country')}</Text>
                <View style={styles.countryList}>
                  <CountryChoice active={draft.country === 'Germany'} flag="🇩🇪" label={t(locale, 'onboarding.germany')} onPress={() => selectCountry('Germany')} />
                  <CountryChoice active={draft.country === 'United Kingdom'} flag="🇬🇧" label={t(locale, 'onboarding.unitedKingdom')} onPress={() => selectCountry('United Kingdom')} />
                </View>
              </View>
            </StepHeading>
          )}

          {step === 1 && (
            <StepHeading title={t(locale, 'onboarding.audienceTitle')} description={t(locale, 'onboarding.audienceDescription')}>
              <View style={styles.cardList}>
                <ChoiceCard
                  active={draft.audience === 'student'}
                  description={t(locale, 'onboarding.studentDescription')}
                  icon={{ ios: 'graduationcap.fill', android: 'school', web: 'school' }}
                  label={t(locale, 'onboarding.student')}
                  onPress={() => selectAudience('student')}
                />
                <ChoiceCard
                  active={draft.audience === 'dropout'}
                  description={t(locale, 'onboarding.dropoutDescription')}
                  icon={{ ios: 'arrow.triangle.branch', android: 'route', web: 'route' }}
                  label={t(locale, 'onboarding.dropout')}
                  onPress={() => selectAudience('dropout')}
                />
              </View>
            </StepHeading>
          )}

          {step === 2 && (
            <StepHeading title={t(locale, 'onboarding.interestsTitle')} description={t(locale, 'onboarding.interestsDescription')}>
              <View style={styles.interestGrid}>
                {INTERESTS.map((interest) => (
                  <InterestCard
                    key={interest}
                    active={draft.interests.includes(interest)}
                    interest={interest}
                    label={localizeCategory(locale, interest)}
                    onPress={() => toggleInterest(interest)}
                  />
                ))}
              </View>
            </StepHeading>
          )}

        </View>

        <View style={styles.footer}>
          <View style={styles.footerActions}>
            {step > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => setStep((current) => current - 1)} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <AppIcon name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={Palette.blueDark} />
                <Text style={styles.backButtonText}>{t(locale, 'onboarding.back')}</Text>
              </Pressable>
            ) : <View style={styles.backButtonPlaceholder} />}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !isValid || isSaving }}
              disabled={!isValid || isSaving}
              onPress={() => void continueFlow()}
              style={({ pressed }) => [styles.continueButton, (!isValid || isSaving) && styles.buttonDisabled, pressed && styles.pressed]}
            >
              {isSaving ? <ActivityIndicator color={Palette.white} /> : (
                <>
                  <Text style={styles.continueButtonText}>
                    {step === TOTAL_STEPS - 1
                      ? t(locale, isEditing ? 'onboarding.save' : 'onboarding.finish')
                      : t(locale, 'onboarding.continue')}
                  </Text>
                  <AppIcon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={18} tintColor={Palette.white} />
                </>
              )}
            </Pressable>
          </View>
          <Text style={styles.privacy}>{step === TOTAL_STEPS - 1 ? t(locale, 'onboarding.editHint') : t(locale, 'onboarding.privacy')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function StepHeading({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.headingBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

function ChoiceCard({ active, description, icon, label, onPress }: { active: boolean; description: string; icon: AppIconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.choiceCard, active && styles.choiceCardActive, pressed && styles.pressed]}>
      <View style={[styles.choiceIcon, active && styles.choiceIconActive]}><AppIcon name={icon} size={23} tintColor={active ? Palette.white : Palette.blue} /></View>
      <View style={styles.choiceCopy}><Text style={[styles.choiceTitle, active && styles.selectedText]}>{label}</Text><Text style={styles.choiceDescription}>{description}</Text></View>
      <SelectionIndicator active={active} />
    </Pressable>
  );
}

function InterestCard({ active, interest, label, onPress }: { active: boolean; interest: string; label: string; onPress: () => void }) {
  const icons: Record<string, AppIconName> = {
    technology: { ios: 'laptopcomputer', android: 'computer', web: 'computer' },
    business: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
    'skilled-trades': { ios: 'wrench.and.screwdriver.fill', android: 'handyman', web: 'handyman' },
    general: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  };
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.interestCard, active && styles.interestCardActive, pressed && styles.pressed]}>
      <View style={[styles.interestIcon, active && styles.interestIconActive]}><AppIcon name={icons[interest]} size={24} tintColor={active ? Palette.white : Palette.blue} /></View>
      <Text style={[styles.interestLabel, active && styles.selectedText]}>{label}</Text>
      <View style={styles.interestSelection}><SelectionIndicator active={active} /></View>
    </Pressable>
  );
}

function CountryChoice({ active, flag, label, onPress }: { active: boolean; flag: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.countryChoice, active && styles.countryChoiceActive, pressed && styles.pressed]}>
      <Text style={styles.flag}>{flag}</Text><Text style={[styles.countryLabel, active && styles.selectedText]}>{label}</Text><SelectionIndicator active={active} />
    </Pressable>
  );
}

function LanguageChoice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.languageChoice, active && styles.languageChoiceActive, pressed && styles.pressed]}><Text style={[styles.languageLabel, active && styles.languageLabelActive]}>{label}</Text></Pressable>;
}

function SelectionIndicator({ active }: { active: boolean }) {
  return <View style={[styles.selectionIndicator, active && styles.selectionIndicatorActive]}>{active && <AppIcon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={13} tintColor={Palette.white} />}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20 },
  page: { width: '100%', maxWidth: 620, alignSelf: 'center', flex: 1 },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blue },
  eyebrow: { flex: 1, color: Palette.blueDark, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  stepLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  progress: { flexDirection: 'row', gap: 7, paddingTop: 14 },
  progressTrack: { flex: 1, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.surfaceStrong },
  progressTrackActive: { backgroundColor: Palette.blue },
  content: { flex: 1, paddingTop: 28 },
  stepContent: { gap: 24 },
  headingBlock: { gap: 10 },
  title: { color: Palette.blueDark, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7 },
  description: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, maxWidth: 520 },
  cardList: { gap: 10 },
  choiceCard: { minHeight: 104, padding: 15, borderWidth: 1.5, borderColor: Palette.border, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Palette.white, ...Shadows.subtle },
  choiceCardActive: { borderColor: Palette.blue, backgroundColor: Palette.blueSoft },
  choiceIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  choiceIconActive: { backgroundColor: Palette.blue },
  choiceCopy: { flex: 1, gap: 4 },
  choiceTitle: { color: Palette.blueDark, fontSize: 17, fontWeight: '700' },
  choiceDescription: { color: Palette.textSecondary, fontSize: 13, lineHeight: 19 },
  selectedText: { color: Palette.blueDark },
  selectionIndicator: { width: 23, height: 23, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  selectionIndicatorActive: { borderColor: Palette.blue, backgroundColor: Palette.blue },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  interestCard: { width: '48%', minWidth: 145, flexGrow: 1, minHeight: 116, padding: 15, borderRadius: Radius.medium, borderWidth: 1.5, borderColor: Palette.border, backgroundColor: Palette.white, gap: 11, ...Shadows.subtle },
  interestCardActive: { borderColor: Palette.blue, backgroundColor: Palette.blueSoft },
  interestIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  interestIconActive: { backgroundColor: Palette.blue },
  interestLabel: { color: Palette.blueDark, fontSize: 16, fontWeight: '700', paddingRight: 28 },
  interestSelection: { position: 'absolute', top: 16, right: 16 },
  fieldGroup: { gap: 9 },
  fieldLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '700', paddingHorizontal: 3 },
  countryList: { gap: 10 },
  countryChoice: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderRadius: Radius.medium, borderWidth: 1.5, borderColor: Palette.border, backgroundColor: Palette.white },
  countryChoiceActive: { borderColor: Palette.blue, backgroundColor: Palette.blueSoft },
  flag: { fontSize: 24 },
  countryLabel: { flex: 1, color: Palette.blueDark, fontSize: 16, fontWeight: '600' },
  languageControl: { padding: 4, flexDirection: 'row', borderRadius: 15, backgroundColor: Palette.surfaceStrong, gap: 4 },
  languageChoice: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  languageChoiceActive: { backgroundColor: Palette.white, ...Shadows.subtle },
  languageLabel: { color: Palette.textSecondary, fontSize: 15, fontWeight: '600' },
  languageLabelActive: { color: Palette.blueDark, fontWeight: '800' },
  footer: { paddingTop: 20, gap: 12 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { minHeight: 54, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backButtonPlaceholder: { width: 4 },
  backButtonText: { color: Palette.blueDark, fontSize: 16, fontWeight: '700' },
  continueButton: { minHeight: 54, flex: 1, paddingHorizontal: 20, borderRadius: 15, backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, ...Shadows.floating },
  continueButtonText: { color: Palette.white, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  buttonDisabled: { backgroundColor: '#9AB8F6', boxShadow: 'none' },
  privacy: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 20 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
