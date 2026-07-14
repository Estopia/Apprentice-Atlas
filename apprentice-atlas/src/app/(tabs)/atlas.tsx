import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { usePreferences } from '@/hooks/use-preferences';
import { groupApplications, summarizeApplications, type ApplicationSummary } from '@/lib/atlas';
import { listApplications, type ApplicationsError } from '@/lib/applications';
import { getReadableAuthError, type AuthError } from '@/lib/auth';
import { localizeApplicationStatus, localizeCategory, localizeCountry, t, useLocale, type Locale } from '@/lib/i18n';
import type { TrackedApplication } from '@/types/jobs';

export default function AtlasScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const auth = useAuth();
  const { preferences, isHydrated } = usePreferences();
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<ApplicationsError | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<AuthError | null>(null);
  const userId = auth.session?.user.id ?? null;

  useEffect(() => {
    if (auth.loading || !userId) return;
    let active = true;
    void listApplications().then((result) => {
      if (!active) return;
      setApplications(result.data ?? []);
      setApplicationsError(result.error);
      setLoadedForUserId(userId);
    });
    return () => { active = false; };
  }, [auth.loading, loadAttempt, userId]);

  const currentApplications = useMemo(
    () => loadedForUserId === userId ? applications : [],
    [applications, loadedForUserId, userId],
  );
  const currentError = loadedForUserId === userId ? applicationsError : null;
  const loading = auth.loading || !isHydrated || Boolean(userId && loadedForUserId !== userId);
  const summary = useMemo(() => summarizeApplications(currentApplications), [currentApplications]);
  const groups = useMemo(() => groupApplications(currentApplications), [currentApplications]);

  const retry = () => {
    setLoadedForUserId(null);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const signOut = async () => {
    setSignOutError(null);
    setSignOutBusy(true);
    const result = await auth.signOut();
    setSignOutError(result.error);
    setSignOutBusy(false);
  };

  const audience = preferences.audience === 'student'
    ? t(locale, 'atlas.audienceStudent')
    : preferences.audience === 'dropout'
      ? t(locale, 'atlas.audienceDropout')
      : t(locale, 'atlas.notSet');
  const interests = preferences.interests.length
    ? preferences.interests.map((interest) => localizeCategory(locale, interest)).join(', ')
    : t(locale, 'atlas.notSet');
  const country = preferences.country ? localizeCountry(locale, preferences.country) : t(locale, 'atlas.notSet');
  const language = preferences.locale === 'de' ? 'Deutsch' : 'English';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }} size={25} tintColor={Palette.white} />
        </View>
        <View style={styles.headerCopy}>
          <Text selectable style={styles.title}>{t(locale, 'atlas.title')}</Text>
          <Text style={styles.subtitle}>{t(locale, 'atlas.subtitle')}</Text>
        </View>
      </View>

      {loading ? (
        <StatePanel loading title={t(locale, 'atlas.loading')} />
      ) : auth.session ? (
        <>
          <ProgressOverview locale={locale} summary={summary} />
          {currentError ? (
            <StatePanel
              action={t(locale, 'atlas.retry')}
              body={t(locale, 'atlas.errorBody')}
              error
              onPress={retry}
              title={t(locale, 'atlas.errorTitle')}
            />
          ) : currentApplications.length === 0 ? (
            <StatePanel
              action={t(locale, 'atlas.discover')}
              body={t(locale, 'atlas.emptyBody')}
              icon={{ ios: 'map', android: 'map', web: 'map' }}
              onPress={() => router.push('/')}
              title={t(locale, 'atlas.emptyTitle')}
            />
          ) : (
            <>
              <ApplicationSection applications={groups.active} locale={locale} title={t(locale, 'atlas.activeApplications')} />
              {groups.finished.length > 0 && (
                <ApplicationSection applications={groups.finished} locale={locale} title={t(locale, 'atlas.finishedApplications')} />
              )}
            </>
          )}
        </>
      ) : (
        <SignedOutCard locale={locale} onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/atlas' } })} />
      )}

      {!loading && (
        <View style={styles.section}>
          <SectionHeader
            action={t(locale, 'atlas.editPreferences')}
            onPress={() => router.push('/onboarding')}
            title={t(locale, 'atlas.preferences')}
          />
          <View style={styles.groupedSurface}>
            <PreferenceRow icon={{ ios: 'person.text.rectangle', android: 'badge', web: 'badge' }} label={t(locale, 'atlas.audience')} value={audience} />
            <PreferenceRow icon={{ ios: 'sparkles', android: 'interests', web: 'interests' }} label={t(locale, 'atlas.interests')} value={interests} />
            <PreferenceRow icon={{ ios: 'globe.europe.africa.fill', android: 'public', web: 'public' }} label={t(locale, 'atlas.country')} value={country} />
            <PreferenceRow icon={{ ios: 'character.bubble.fill', android: 'language', web: 'language' }} label={t(locale, 'atlas.language')} last value={language} />
          </View>
        </View>
      )}

      {!loading && auth.session && (
        <View style={styles.section}>
          <SectionHeader title={t(locale, 'atlas.account')} />
          <View style={styles.accountCard}>
            <View style={styles.avatar}>
              <Text selectable style={styles.avatarText}>{(auth.user?.email ?? 'A').slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text selectable numberOfLines={2} style={styles.email}>{auth.user?.email ?? ''}</Text>
            <Pressable
              accessibilityLabel={t(locale, 'auth.signOut')}
              accessibilityRole="button"
              accessibilityState={{ disabled: signOutBusy }}
              disabled={signOutBusy}
              onPress={() => void signOut()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>{signOutBusy ? t(locale, 'auth.signingOut') : t(locale, 'auth.signOut')}</Text>
            </Pressable>
          </View>
          {(signOutError ?? auth.error) && (
            <Text accessibilityRole="alert" selectable style={styles.inlineError}>
              {getReadableAuthError((signOutError ?? auth.error)!, locale)}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ProgressOverview({ locale, summary }: { locale: Locale; summary: ApplicationSummary }) {
  const metrics = [
    [t(locale, 'atlas.active'), summary.active],
    [t(locale, 'atlas.interviews'), summary.interviews],
    [t(locale, 'atlas.offers'), summary.offers],
    [t(locale, 'atlas.finished'), summary.finished],
  ] as const;
  return (
    <View style={styles.section}>
      <SectionHeader title={t(locale, 'atlas.progress')} />
      <View accessibilityLabel={`${t(locale, 'atlas.total')}: ${summary.total}`} style={styles.progressCard}>
        <View style={styles.totalBlock}>
          <Text selectable style={styles.totalValue}>{summary.total}</Text>
          <Text style={styles.totalLabel}>{t(locale, 'atlas.total')}</Text>
        </View>
        <View style={styles.metrics}>
          {metrics.map(([label, value]) => (
            <View key={label} style={styles.metric}>
              <Text selectable style={styles.metricValue}>{value}</Text>
              <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ApplicationSection({ applications, locale, title }: { applications: TrackedApplication[]; locale: Locale; title: string }) {
  if (applications.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader count={applications.length} title={title} />
      <View style={styles.groupedSurface}>
        {applications.map((application, index) => (
          <ApplicationRow key={application.id} application={application} last={index === applications.length - 1} locale={locale} />
        ))}
      </View>
    </View>
  );
}

function ApplicationRow({ application, last, locale }: { application: TrackedApplication; last: boolean; locale: Locale }) {
  const router = useRouter();
  const job = application.job;
  const status = localizeApplicationStatus(locale, application.status);
  const updated = new Date(application.updatedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const title = job?.title ?? t(locale, 'atlas.unavailable');
  return (
    <Pressable
      accessibilityLabel={job ? `${job.title}, ${status}` : t(locale, 'atlas.unavailable')}
      accessibilityRole={job ? 'button' : undefined}
      accessibilityState={{ disabled: !job }}
      disabled={!job}
      onPress={() => job && router.push(`/job/${job.id}`)}
      style={({ pressed }) => [styles.applicationRow, !last && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={styles.applicationIcon}>
        <Text selectable style={styles.applicationIconText}>{(job?.company ?? '?').slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.applicationCopy}>
        <Text selectable numberOfLines={2} style={styles.applicationTitle}>{title}</Text>
        {job && <Text selectable numberOfLines={1} style={styles.applicationCompany}>{job.company} · {job.city}</Text>}
        <Text style={styles.updated}>{t(locale, 'atlas.updated')} {updated}</Text>
      </View>
      <View style={[styles.statusPill, application.status === 'offer' && styles.statusSuccess, application.status === 'closed' && styles.statusMuted]}>
        <Text style={[styles.statusText, application.status === 'offer' && styles.statusSuccessText, application.status === 'closed' && styles.statusMutedText]}>{status}</Text>
      </View>
      {job && <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={Palette.textSecondary} />}
    </Pressable>
  );
}

function PreferenceRow({ icon, label, last, value }: { icon: AppIconName; label: string; last?: boolean; value: string }) {
  return (
    <View style={[styles.preferenceRow, !last && styles.rowDivider]}>
      <View style={styles.preferenceIcon}><AppIcon name={icon} size={18} tintColor={Palette.blue} /></View>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <Text selectable style={styles.preferenceValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ action, count, onPress, title }: { action?: string; count?: number; onPress?: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof count === 'number' && <Text selectable style={styles.sectionCount}>{count}</Text>}
      {action && onPress && (
        <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
          <Text style={styles.headerActionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SignedOutCard({ locale, onPress }: { locale: Locale; onPress: () => void }) {
  return (
    <View style={styles.signedOutCard}>
      <View style={styles.signedOutIcon}><AppIcon name={{ ios: 'lock.shield.fill', android: 'shield_lock', web: 'lock' }} size={24} tintColor={Palette.blue} /></View>
      <View style={styles.signedOutCopy}>
        <Text style={styles.stateTitle}>{t(locale, 'atlas.signedOutTitle')}</Text>
        <Text style={styles.stateBody}>{t(locale, 'atlas.signedOutBody')}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{t(locale, 'atlas.signIn')}</Text>
      </Pressable>
    </View>
  );
}

function StatePanel({ action, body, error, icon, loading, onPress, title }: { action?: string; body?: string; error?: boolean; icon?: AppIconName; loading?: boolean; onPress?: () => void; title: string }) {
  return (
    <View accessibilityRole={error ? 'alert' : undefined} style={styles.statePanel}>
      {loading ? <ActivityIndicator color={Palette.blue} /> : (
        <View style={styles.stateIcon}><AppIcon name={icon ?? { ios: 'exclamationmark.arrow.triangle.2.circlepath', android: 'sync_problem', web: 'error' }} size={24} tintColor={Palette.blue} /></View>
      )}
      <Text selectable style={styles.stateTitle}>{title}</Text>
      {body && <Text selectable={error} style={styles.stateBody}>{body}</Text>}
      {action && onPress && (
        <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 128, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 2, paddingBottom: 2 },
  headerIcon: { width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blue },
  headerCopy: { flex: 1, gap: 3 },
  title: { color: Palette.blueDark, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20 },
  section: { gap: 9 },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  sectionTitle: { flex: 1, color: Palette.blueDark, fontSize: 17, fontWeight: '700' },
  sectionCount: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: Palette.blueSoft, color: Palette.blue, textAlign: 'center', lineHeight: 26, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  headerAction: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  headerActionText: { color: Palette.blue, fontSize: 14, fontWeight: '700' },
  groupedSurface: { overflow: 'hidden', borderRadius: Radius.medium, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  progressCard: { minHeight: 116, borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.blueDark, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, ...Shadows.subtle },
  totalBlock: { width: 68, alignItems: 'center', gap: 2 },
  totalValue: { color: Palette.white, fontSize: 34, lineHeight: 38, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totalLabel: { color: '#C9D8F5', fontSize: 12, fontWeight: '600' },
  metrics: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#496087', paddingLeft: 12, rowGap: 13 },
  metric: { width: '50%', gap: 1 },
  metricValue: { color: Palette.white, fontSize: 18, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: '#C9D8F5', fontSize: 11, fontWeight: '600' },
  applicationRow: { minHeight: 92, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.white },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  applicationIcon: { width: 42, height: 42, borderRadius: 13, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  applicationIconText: { color: Palette.blue, fontSize: 16, fontWeight: '800' },
  applicationCopy: { flex: 1, minWidth: 0, gap: 2 },
  applicationTitle: { color: Palette.text, fontSize: 15, lineHeight: 19, fontWeight: '700' },
  applicationCompany: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17 },
  updated: { color: Palette.textSecondary, fontSize: 10, lineHeight: 14 },
  statusPill: { maxWidth: 94, borderRadius: Radius.pill, backgroundColor: Palette.blueSoft, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { color: Palette.blue, fontSize: 10, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  statusSuccess: { backgroundColor: '#E6F6EE' },
  statusSuccessText: { color: Palette.success },
  statusMuted: { backgroundColor: Palette.surfaceStrong },
  statusMutedText: { color: Palette.textSecondary },
  preferenceRow: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  preferenceIcon: { width: 34, height: 34, borderRadius: 11, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  preferenceLabel: { width: 92, color: Palette.textSecondary, fontSize: 12, fontWeight: '600' },
  preferenceValue: { flex: 1, color: Palette.text, fontSize: 14, lineHeight: 19, fontWeight: '600', textAlign: 'right' },
  accountCard: { minHeight: 74, padding: 13, borderRadius: Radius.medium, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Palette.blue, fontSize: 17, fontWeight: '800' },
  email: { flex: 1, color: Palette.text, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  secondaryButton: { minWidth: 88, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderCurve: 'continuous', backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Palette.blue, fontSize: 13, fontWeight: '700' },
  inlineError: { color: Palette.danger, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  signedOutCard: { borderRadius: Radius.large, borderCurve: 'continuous', backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, padding: 18, gap: 14, ...Shadows.subtle },
  signedOutIcon: { width: 46, height: 46, borderRadius: 15, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  signedOutCopy: { gap: 6 },
  statePanel: { minHeight: 190, borderRadius: Radius.large, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateIcon: { width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  stateTitle: { color: Palette.blueDark, fontSize: 17, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  stateBody: { maxWidth: 450, color: Palette.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primaryButton: { minWidth: 124, minHeight: 48, paddingHorizontal: 18, borderRadius: 13, borderCurve: 'continuous', backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  primaryButtonText: { color: Palette.white, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});
