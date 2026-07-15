import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { groupApplications, safeTimestamp, summarizeApplications, type ApplicationSummary } from '@/lib/atlas';
import { deriveAtlasNextAction, type AtlasNextAction } from '@/lib/atlas-next-action';
import { listApplications, type ApplicationsError } from '@/lib/applications';
import { localizeApplicationStatus, t, useLocale, type Locale } from '@/lib/i18n';
import type { TrackedApplication } from '@/types/jobs';

export default function AtlasScreen() {
  const [locale] = useLocale();
  const router = useRouter();
  const auth = useAuth();
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [loadedForSessionKey, setLoadedForSessionKey] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<ApplicationsError | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const latestLoadAttempt = useRef(0);
  const userId = auth.session?.user.id ?? null;
  const sessionKey = auth.session ? `${auth.session.user.id}:${auth.session.access_token}` : null;

  const loadApplications = useCallback(() => {
    if (auth.loading || !userId || !sessionKey) return undefined;
    let active = true;
    const requestedAttempt = loadAttempt;
    void listApplications({ expectedUserId: userId }).then((result) => {
      if (!active || requestedAttempt !== latestLoadAttempt.current) return;
      setApplications(result.data ?? []);
      setApplicationsError(result.error);
      setLoadedForSessionKey(sessionKey);
    });
    return () => { active = false; };
  }, [auth.loading, loadAttempt, sessionKey, userId]);

  useFocusEffect(loadApplications);

  const currentApplications = useMemo(
    () => loadedForSessionKey === sessionKey ? applications : [],
    [applications, loadedForSessionKey, sessionKey],
  );
  const currentError = loadedForSessionKey === sessionKey ? applicationsError : null;
  const loading = auth.loading || Boolean(sessionKey && loadedForSessionKey !== sessionKey);
  const summary = useMemo(() => summarizeApplications(currentApplications), [currentApplications]);
  const groups = useMemo(() => groupApplications(currentApplications), [currentApplications]);
  const nextAction = useMemo(() => deriveAtlasNextAction(currentApplications), [currentApplications]);

  const retry = () => {
    setLoadedForSessionKey(null);
    latestLoadAttempt.current += 1;
    setLoadAttempt(latestLoadAttempt.current);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text selectable style={styles.title}>{t(locale, 'atlas.title')}</Text>
          <Text style={styles.subtitle}>{t(locale, 'atlas.subtitle')}</Text>
        </View>
        <Pressable
          accessibilityLabel={t(locale, 'settings.title')}
          accessibilityRole="button"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
        >
          <AppIcon name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={21} tintColor={Palette.text} />
        </Pressable>
      </View>

      {loading ? (
        <StatePanel loading title={t(locale, 'atlas.loading')} />
      ) : !auth.session ? (
        <SignedOutPanel locale={locale} onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/atlas' } })} />
      ) : currentError ? (
        <StatePanel
          action={t(locale, 'atlas.retry')}
          body={t(locale, 'atlas.errorBody')}
          error
          onPress={retry}
          title={t(locale, 'atlas.errorTitle')}
        />
      ) : (
        <>
          <NextActionPanel
            action={nextAction}
            locale={locale}
            onPress={() => nextAction.kind === 'prepare-interview' && nextAction.application
              ? router.push({ pathname: '/prepare/[jobId]', params: { jobId: nextAction.application.jobId } })
              : nextAction.application
                ? router.push({ pathname: '/application/[jobId]', params: { jobId: nextAction.application.jobId } } as never)
                : router.push('/')}
          />
          <ApplicationSection applications={groups.active} locale={locale} title={t(locale, 'atlas.activeApplications')} />
          <ProgressOverview locale={locale} summary={summary} />
          {groups.finished.length > 0 && <ApplicationSection applications={groups.finished} locale={locale} title={t(locale, 'atlas.finishedApplications')} />}
        </>
      )}

    </ScrollView>
  );
}

function NextActionPanel({ action, locale, onPress }: { action: AtlasNextAction; locale: Locale; onPress: () => void }) {
  const key = action.kind === 'discover'
    ? 'discover'
    : action.kind === 'start-application'
      ? 'interested'
      : action.kind === 'continue-application'
        ? 'preparing'
        : action.kind === 'follow-up'
          ? 'applied'
          : action.kind === 'prepare-interview'
            ? 'interview'
            : 'offer';
  const job = action.application?.job;
  return (
    <View style={styles.nextActionSection}>
      <Text style={styles.eyebrow}>{t(locale, 'atlas.nextAction')}</Text>
      <Text style={styles.nextTitle}>{t(locale, `atlas.next.${key}Title`)}</Text>
      <Text style={styles.nextBody}>{t(locale, `atlas.next.${key}Body`)}</Text>
      {action.application && <Text numberOfLines={2} style={styles.nextTarget}>{job?.title ?? t(locale, 'atlas.unavailable')}{job ? ` · ${job.company}` : ''}</Text>}
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{t(locale, action.kind === 'prepare-interview' ? 'atlas.next.prepareAction' : action.application ? 'atlas.next.openApplication' : 'atlas.next.discoverAction')}</Text>
        <AppIcon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={17} tintColor={Palette.white} />
      </Pressable>
    </View>
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
      <View accessibilityLabel={`${t(locale, 'atlas.total')}: ${summary.total}`} style={styles.metricsRow}>
        {metrics.map(([label, value]) => (
          <View accessible accessibilityLabel={`${label}: ${value}`} key={label} style={styles.metric}>
            <Text selectable style={styles.metricValue}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
          </View>
        ))}
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
        {applications.map((application, index) => <ApplicationRow key={application.id} application={application} last={index === applications.length - 1} locale={locale} />)}
      </View>
    </View>
  );
}

function ApplicationRow({ application, last, locale }: { application: TrackedApplication; last: boolean; locale: Locale }) {
  const router = useRouter();
  const job = application.job;
  const status = localizeApplicationStatus(locale, application.status);
  const updatedTimestamp = safeTimestamp(application.updatedAt);
  const updated = updatedTimestamp === null
    ? t(locale, 'atlas.updatedFallback')
    : `${t(locale, 'atlas.updated')} ${new Date(updatedTimestamp).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  const title = job?.title ?? t(locale, 'atlas.unavailable');
  const interviewTimestamp = application.interviewAt ? safeTimestamp(application.interviewAt) : null;
  return (
    <Pressable
      accessibilityLabel={`${title}, ${status}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/application/[jobId]', params: { jobId: application.jobId } } as never)}
      style={({ pressed }) => [styles.applicationRow, !last && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={styles.applicationIcon}><Text selectable style={styles.applicationIconText}>{(job?.company ?? '?').slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.applicationCopy}>
        <Text selectable numberOfLines={2} style={styles.applicationTitle}>{title}</Text>
        {job && <Text selectable numberOfLines={1} style={styles.applicationCompany}>{job.company} · {job.city}</Text>}
        {interviewTimestamp !== null && <Text style={styles.interviewDate}>{t(locale, 'application.interviewDate')}: {new Date(interviewTimestamp).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text>}
        <Text style={styles.updated}>{updated}</Text>
      </View>
      <Text style={[styles.statusText, application.status === 'offer' && styles.statusSuccessText, application.status === 'closed' && styles.statusMutedText]}>{status}</Text>
      <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={Palette.textSecondary} />
    </Pressable>
  );
}

function SectionHeader({ action, count, onPress, title }: { action?: string; count?: number; onPress?: () => void; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof count === 'number' && <Text selectable style={styles.sectionCount}>{count}</Text>}
      {action && onPress && (
        <Pressable accessibilityLabel={action} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
          <Text style={styles.headerActionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SignedOutPanel({ locale, onPress }: { locale: Locale; onPress: () => void }) {
  return (
    <View style={styles.signedOutPanel}>
      <View style={styles.signedOutIcon}><AppIcon name={{ ios: 'lock.shield', android: 'shield', web: 'lock' }} size={25} tintColor={Palette.blue} /></View>
      <Text style={styles.stateTitle}>{t(locale, 'atlas.signedOutTitle')}</Text>
      <Text style={styles.stateBody}>{t(locale, 'atlas.signedOutBody')}</Text>
      <Pressable accessibilityLabel={t(locale, 'atlas.signIn')} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, styles.centerButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{t(locale, 'atlas.signIn')}</Text>
      </Pressable>
    </View>
  );
}

function StatePanel({ action, body, error, loading, onPress, title }: { action?: string; body?: string; error?: boolean; loading?: boolean; onPress?: () => void; title: string }) {
  return (
    <View accessibilityRole={error ? 'alert' : undefined} style={styles.statePanel}>
      {loading ? <ActivityIndicator color={Palette.blue} /> : <AppIcon name={{ ios: 'exclamationmark.arrow.triangle.2.circlepath', android: 'sync_problem', web: 'error' }} size={28} tintColor={Palette.blue} />}
      <Text selectable style={styles.stateTitle}>{title}</Text>
      {body && <Text selectable={error} style={styles.stateBody}>{body}</Text>}
      {action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, styles.centerButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{action}</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 128, gap: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  header: { gap: 3, paddingHorizontal: 2, paddingBottom: 2 },
  title: { color: Palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20 },
  settingsButton: { width: 44, height: 44, marginLeft: 'auto', borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  nextActionSection: { paddingVertical: 4, gap: 8 },
  eyebrow: { color: Palette.blue, fontSize: 13, lineHeight: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextTitle: { color: Palette.text, fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.4 },
  nextBody: { maxWidth: 560, color: Palette.textSecondary, fontSize: 15, lineHeight: 22 },
  nextTarget: { color: Palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  section: { gap: 8 },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  sectionTitle: { flex: 1, color: Palette.text, fontSize: 17, fontWeight: '700' },
  sectionCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: Palette.blueSoft, color: Palette.blue, textAlign: 'center', lineHeight: 28, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  headerAction: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  headerActionText: { color: Palette.blue, fontSize: 14, fontWeight: '700' },
  groupedSurface: { overflow: 'hidden', borderRadius: Radius.medium, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Palette.border, paddingVertical: 8 },
  metric: { width: '50%', minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: 7, paddingHorizontal: 4 },
  metricValue: { color: Palette.text, fontSize: 21, lineHeight: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: Palette.textSecondary, fontSize: 13, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
  applicationRow: { minHeight: 94, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.white },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  applicationIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  applicationIconText: { color: Palette.blue, fontSize: 16, fontWeight: '800' },
  applicationCopy: { flex: 1, minWidth: 0, gap: 2 },
  applicationTitle: { color: Palette.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  applicationCompany: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
  interviewDate: { color: Palette.blue, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  updated: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
  statusText: { maxWidth: 96, color: Palette.blue, fontSize: 13, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  statusSuccessText: { color: Palette.success },
  statusMutedText: { color: Palette.textSecondary },
  signedOutPanel: { minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  signedOutIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statePanel: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateTitle: { color: Palette.text, fontSize: 20, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  stateBody: { maxWidth: 450, color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primaryButton: { minHeight: 48, paddingHorizontal: 18, borderRadius: 13, backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', gap: 8, marginTop: 4 },
  centerButton: { alignSelf: 'center' },
  primaryButtonText: { color: Palette.white, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});
