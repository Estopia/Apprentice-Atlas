import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  getApplicationForJob,
  getReadableApplicationsError,
  removeApplication,
  upsertApplication,
  type ApplicationsError,
  type ApplicationsOperation,
} from '@/lib/applications';
import {
  APPLICATION_STATUSES,
  applicationNoteLength,
  confirmApplicationRemovalOnWeb,
  isApplicationDraftValid,
  isValidApplicationJobId,
  resolveApplicationSheetLoad,
} from '@/lib/application-flow';
import { localizeApplicationStatus, t, useLocale } from '@/lib/i18n';
import { getJob } from '@/lib/jobs';
import type { ApplicationStatus, Job, TrackedApplication } from '@/types/jobs';

export default function ApplicationSheet() {
  const params = useLocalSearchParams<{ jobId?: string }>();
  const routeJobId = typeof params.jobId === 'string' ? params.jobId : '';
  const validJobId = isValidApplicationJobId(routeJobId);
  const router = useRouter();
  const [locale] = useLocale();
  const auth = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [application, setApplication] = useState<TrackedApplication | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>('interested');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyOperation, setBusyOperation] = useState<ApplicationsOperation | null>(null);
  const mountedRef = useRef(false);
  const redirectStarted = useRef(false);
  const sessionKey = auth.session ? `${auth.session.user.id}:${auth.session.access_token}` : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const redirectToAuth = useCallback(() => {
    if (!validJobId || redirectStarted.current) return;
    redirectStarted.current = true;
    router.replace({
      pathname: '/auth',
      params: { returnTo: `/job/${routeJobId}`, pendingAction: 'track', jobId: routeJobId },
    });
  }, [routeJobId, router, validJobId]);

  useEffect(() => {
    if (!validJobId || auth.loading) return;
    if (!auth.session) {
      redirectToAuth();
      return;
    }

    let active = true;
    void Promise.all([getJob(routeJobId, undefined, locale), getApplicationForJob(routeJobId)]).then(([jobResult, applicationResult]) => {
      if (!active || !mountedRef.current) return;
      const resolution = resolveApplicationSheetLoad(jobResult, applicationResult);
      if (resolution.kind === 'redirect') {
        setLoading(false);
        redirectToAuth();
        return;
      }
      if (resolution.kind === 'error') {
        setError(resolution.reason === 'application' && applicationResult.error
          ? getReadableApplicationsError(applicationResult.error, locale, 'load')
          : t(locale, resolution.reason === 'job-load' ? 'application.error.load' : 'application.error.jobUnavailable'));
      } else {
        const existing = resolution.application;
        setError(null);
        setJob(resolution.job);
        setApplication(existing);
        setStatus(existing?.status ?? 'interested');
        setNote(existing?.note ?? '');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [auth.loading, auth.session, loadAttempt, locale, redirectToAuth, routeJobId, sessionKey, validJobId]);

  const noteLength = applicationNoteLength(note);
  const noteTooLong = noteLength > 500;
  const busy = busyOperation !== null;

  const handleOperationError = (operation: ApplicationsOperation, operationError: ApplicationsError) => {
    if (operationError.code === 'auth-required') {
      setBusyOperation(null);
      redirectToAuth();
      return;
    }
    setError(getReadableApplicationsError(operationError, locale, operation));
    setBusyOperation(null);
  };

  const save = async () => {
    if (!validJobId || busy) return;
    if (!isApplicationDraftValid(status, note)) {
      setError(t(locale, 'application.noteTooLong'));
      return;
    }
    setError(null);
    setBusyOperation('save');
    const result = await upsertApplication(routeJobId, status, note);
    if (!mountedRef.current) return;
    if (result.error) {
      handleOperationError('save', result.error);
      return;
    }
    router.back();
  };

  const remove = async () => {
    if (!validJobId || busy) return;
    setError(null);
    setBusyOperation('remove');
    const result = await removeApplication(routeJobId);
    if (!mountedRef.current) return;
    if (result.error) {
      handleOperationError('remove', result.error);
      return;
    }
    router.back();
  };

  const confirmRemove = () => {
    if (process.env.EXPO_OS === 'web') {
      const webConfirm = typeof globalThis.confirm === 'function'
        ? (message: string) => globalThis.confirm(message)
        : undefined;
      confirmApplicationRemovalOnWeb(
        webConfirm,
        t(locale, 'application.confirmRemoveTitle'),
        t(locale, 'application.confirmRemoveBody'),
        remove,
      );
      return;
    }
    Alert.alert(
      t(locale, 'application.confirmRemoveTitle'),
      t(locale, 'application.confirmRemoveBody'),
      [
        { text: t(locale, 'application.cancel'), style: 'cancel' },
        { text: t(locale, 'application.confirmRemove'), style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode={process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
    >
      {!validJobId ? (
        <StatePanel message={t(locale, 'application.error.invalidJob')} />
      ) : auth.loading || !auth.session ? (
        <StatePanel loading message={t(locale, 'application.redirecting')} />
      ) : loading ? (
        <StatePanel loading message={t(locale, 'application.loading')} />
      ) : error && !job && !application ? (
        <StatePanel
          action={t(locale, 'application.retry')}
          message={error}
          onPress={() => { setError(null); setLoading(true); setLoadAttempt((attempt) => attempt + 1); }}
        />
      ) : job || application ? (
        <View style={styles.form}>
          {job ? (
            <View style={styles.jobContext}>
              <View style={styles.jobIcon}>
                <AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={22} tintColor={Palette.blue} />
              </View>
              <View style={styles.jobCopy}>
                <Text selectable numberOfLines={2} style={styles.jobTitle}>{job.title}</Text>
                <Text selectable numberOfLines={1} style={styles.jobCompany}>{job.company} · {job.city}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.jobContext}>
              <View style={styles.jobIcon}>
                <AppIcon name={{ ios: 'archivebox.fill', android: 'inventory_2', web: 'inventory_2' }} size={22} tintColor={Palette.textSecondary} />
              </View>
              <View style={styles.jobCopy}>
                <Text selectable style={styles.jobTitle}>{t(locale, 'application.listingUnavailableTitle')}</Text>
                <Text selectable style={styles.jobCompany}>{t(locale, 'application.listingUnavailableBody')}</Text>
              </View>
            </View>
          )}

          <View style={styles.privateHint}>
            <AppIcon name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={15} tintColor={Palette.blue} />
            <Text style={styles.privateHintText}>{t(locale, 'application.privateHint')}</Text>
          </View>

          {error && <Text accessibilityRole="alert" selectable style={styles.error}>{error}</Text>}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t(locale, 'application.status')}</Text>
            <View style={styles.group} accessibilityRole="radiogroup">
              {APPLICATION_STATUSES.map((candidate, index) => {
                const selected = status === candidate;
                const label = localizeApplicationStatus(locale, candidate);
                return (
                  <Pressable
                    key={candidate}
                    accessibilityLabel={label}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: busy }}
                    disabled={busy}
                    onPress={() => { setStatus(candidate); setError(null); }}
                    style={({ pressed }) => [styles.statusRow, index < APPLICATION_STATUSES.length - 1 && styles.divider, selected && styles.statusSelected, pressed && styles.pressed]}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.statusText, selected && styles.statusTextSelected]}>{label}</Text>
                    {selected && <AppIcon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={17} tintColor={Palette.blue} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>{t(locale, 'application.note')}</Text>
              <Text accessibilityLiveRegion="polite" style={[styles.counter, noteTooLong && styles.counterInvalid]}>{noteLength}/500 {t(locale, 'application.characters')}</Text>
            </View>
            <TextInput
              accessibilityLabel={t(locale, 'application.note')}
              editable={!busy}
              multiline
              onChangeText={(value) => { setNote(value); setError(null); }}
              placeholder={t(locale, 'application.notePlaceholder')}
              placeholderTextColor={Palette.textSecondary}
              selectionColor={Palette.blue}
              style={[styles.noteInput, noteTooLong && styles.noteInputInvalid]}
              textAlignVertical="top"
              value={note}
            />
            {noteTooLong && <Text accessibilityRole="alert" style={styles.validationError}>{t(locale, 'application.noteTooLong')}</Text>}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(locale, 'application.save')}
            accessibilityState={{ disabled: busy || noteTooLong }}
            disabled={busy || noteTooLong}
            onPress={() => void save()}
            style={({ pressed }) => [styles.saveButton, (busy || noteTooLong) && styles.disabled, pressed && styles.pressed]}
          >
            {busyOperation === 'save' && <ActivityIndicator color={Palette.white} />}
            <Text style={styles.saveText}>{busyOperation === 'save' ? t(locale, 'application.saving') : t(locale, 'application.save')}</Text>
          </Pressable>

          {application && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(locale, 'application.remove')}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={confirmRemove}
              style={({ pressed }) => [styles.removeButton, busy && styles.disabled, pressed && styles.pressed]}
            >
              {busyOperation === 'remove' && <ActivityIndicator color={Palette.danger} />}
              <Text style={styles.removeText}>{busyOperation === 'remove' ? t(locale, 'application.removing') : t(locale, 'application.remove')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function StatePanel({ action, loading, message, onPress }: { action?: string; loading?: boolean; message: string; onPress?: () => void }) {
  return (
    <View style={styles.statePanel}>
      {loading ? <ActivityIndicator color={Palette.blue} size="large" /> : <AppIcon name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }} size={30} tintColor={Palette.blue} />}
      <Text accessibilityRole={loading ? undefined : 'alert'} selectable style={styles.stateText}>{message}</Text>
      {action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.retryText}>{action}</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 56 },
  form: { gap: 18 },
  jobContext: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderCurve: 'continuous', backgroundColor: Palette.white },
  jobIcon: { width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueSoft },
  jobCopy: { flex: 1, minWidth: 0, gap: 3 },
  jobTitle: { color: Palette.text, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  jobCompany: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
  privateHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  privateHintText: { flex: 1, color: Palette.textSecondary, fontSize: 12, lineHeight: 17 },
  error: { color: Palette.danger, fontSize: 13, lineHeight: 18, fontWeight: '600', paddingHorizontal: 4 },
  section: { gap: 8 },
  sectionLabel: { color: Palette.text, fontSize: 14, fontWeight: '700', paddingHorizontal: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  counter: { color: Palette.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  counterInvalid: { color: Palette.danger, fontWeight: '700' },
  group: { overflow: 'hidden', borderRadius: 18, borderCurve: 'continuous', backgroundColor: Palette.white },
  statusRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: Palette.white },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  statusSelected: { backgroundColor: Palette.blueSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  radioSelected: { borderColor: Palette.blue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.blue },
  statusText: { flex: 1, color: Palette.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  statusTextSelected: { color: Palette.blue },
  noteInput: { minHeight: 126, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, borderCurve: 'continuous', backgroundColor: Palette.white, color: Palette.text, fontSize: 15, lineHeight: 21, padding: 14 },
  noteInputInvalid: { borderColor: Palette.danger },
  validationError: { color: Palette.danger, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
  saveButton: { minHeight: 52, borderRadius: 16, borderCurve: 'continuous', backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  saveText: { color: Palette.white, fontSize: 16, fontWeight: '700' },
  removeButton: { minHeight: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  removeText: { color: Palette.danger, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  statePanel: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  stateText: { color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 },
  retryButton: { minHeight: 44, borderRadius: 13, borderCurve: 'continuous', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: Palette.blueSoft },
  retryText: { color: Palette.blue, fontWeight: '700' },
});
