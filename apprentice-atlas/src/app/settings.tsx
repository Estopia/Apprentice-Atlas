import Constants from 'expo-constants';
import * as Print from 'expo-print';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { usePreferences } from '@/hooks/use-preferences';
import { buildAccountExport, buildAccountPdfHtml, deleteAccount, retryAccountCleanup, type AccountCleanupWarning, type AccountExport } from '@/lib/account';
import { listApplications } from '@/lib/applications';
import { listFavorites } from '@/lib/favorites';
import { localizeCountry, t, useLocale } from '@/lib/i18n';
import { LEGAL_URLS } from '@/lib/legal';

export default function SettingsScreen() {
  const { from } = useLocalSearchParams<{ from?: 'home' | 'atlas' }>();
  const [locale] = useLocale();
  const auth = useAuth();
  const { preferences, savePreferences, completeOnboarding } = usePreferences();
  const [busy, setBusy] = useState<'export-json' | 'export-pdf' | 'delete' | 'signout' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseLanguage = () => Alert.alert(t(locale, 'settings.selectLanguage'), undefined, [
    { text: 'Deutsch', onPress: () => void savePreferences({ ...preferences, locale: 'de' }) },
    { text: 'English', onPress: () => void savePreferences({ ...preferences, locale: 'en' }) },
    { text: t(locale, 'settings.cancel'), style: 'cancel' },
  ]);
  const chooseCountry = () => Alert.alert(t(locale, 'settings.selectCountry'), undefined, [
    { text: localizeCountry(locale, 'Germany'), onPress: () => void completeOnboarding({ ...preferences, country: 'Germany' }) },
    { text: localizeCountry(locale, 'United Kingdom'), onPress: () => void completeOnboarding({ ...preferences, country: 'United Kingdom' }) },
    { text: t(locale, 'settings.cancel'), style: 'cancel' },
  ]);

  const collectAccountData = async (): Promise<AccountExport | null> => {
    if (!auth.user) return null;
    const userId = auth.session?.user.id;
    const [favorites, applications] = await Promise.all([
      listFavorites(userId ? { expectedUserId: userId } : undefined),
      listApplications(userId ? { expectedUserId: userId } : undefined),
    ]);
    if (favorites.error || applications.error || !favorites.data || !applications.data) {
      setError(t(locale, 'settings.exportError'));
      return null;
    }
    return buildAccountExport({ user: auth.user, preferences, favorites: favorites.data, applications: applications.data });
  };

  const exportData = async () => {
    if (!auth.user || busy) return;
    setError(null); setBusy('export-json');
    try {
      const data = await collectAccountData();
      if (!data) return;
      await Share.share({ title: t(locale, 'settings.exportReady'), message: JSON.stringify(data, null, 2) });
    } catch {
      setError(t(locale, 'settings.exportError'));
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    if (!auth.user || busy) return;
    if (Platform.OS === 'web') {
      Alert.alert(t(locale, 'settings.pdfWebTitle'), t(locale, 'settings.pdfWebFallback'));
      return;
    }
    setError(null); setBusy('export-pdf');
    try {
      const data = await collectAccountData();
      if (!data) return;
      if (!await Sharing.isAvailableAsync()) {
        setError(t(locale, 'settings.pdfShareUnavailable'));
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: buildAccountPdfHtml(data, locale) });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: t(locale, 'settings.pdfReady'),
      });
    } catch {
      setError(t(locale, 'settings.exportError'));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => Alert.alert(t(locale, 'settings.deleteTitle'), t(locale, 'settings.deleteBody'), [
    { text: t(locale, 'settings.cancel'), style: 'cancel' },
    { text: t(locale, 'settings.deleteConfirm'), style: 'destructive', onPress: () => void performDelete() },
  ]);
  function continueAfterDelete(appleAccessNeedsRevocation: boolean) {
    if (appleAccessNeedsRevocation) {
      Alert.alert(t(locale, 'settings.appleRevokeTitle'), t(locale, 'settings.appleRevokeBody'), [
        { text: t(locale, 'settings.done'), onPress: () => router.replace('/') },
      ], { cancelable: false });
      return;
    }
    router.replace('/');
  }
  function showCleanupWarning(cleanupWarning: AccountCleanupWarning, appleAccessNeedsRevocation: boolean, retryFailed = false) {
    Alert.alert(
      t(locale, 'settings.cleanupTitle'),
      t(locale, retryFailed ? 'settings.cleanupRetryFailedBody' : 'settings.cleanupBody'),
      [
        { text: t(locale, 'settings.cleanupContinue'), style: 'cancel', onPress: () => continueAfterDelete(appleAccessNeedsRevocation) },
        { text: t(locale, 'settings.cleanupRetry'), onPress: () => void retryCleanup(cleanupWarning, appleAccessNeedsRevocation) },
      ],
      { cancelable: false },
    );
  }
  async function retryCleanup(cleanupWarning: AccountCleanupWarning, appleAccessNeedsRevocation: boolean) {
    const outcome = await retryAccountCleanup(cleanupWarning);
    if (outcome === 'incomplete') {
      showCleanupWarning(cleanupWarning, appleAccessNeedsRevocation, true);
      return;
    }
    Alert.alert(
      t(locale, 'settings.cleanupSuccessTitle'),
      t(locale, 'settings.cleanupSuccessBody'),
      [{ text: t(locale, 'settings.cleanupContinue'), onPress: () => continueAfterDelete(appleAccessNeedsRevocation) }],
      { cancelable: false },
    );
  }
  const performDelete = async () => {
    if (busy) return;
    setError(null); setBusy('delete');
    const result = await deleteAccount();
    if (result.error || !result.data) { setError(t(locale, 'settings.deleteError')); setBusy(null); return; }
    const appleAccessNeedsRevocation = result.data.appleAccessNeedsRevocation;
    if (result.cleanupWarning) {
      showCleanupWarning(result.cleanupWarning, appleAccessNeedsRevocation);
      return;
    }
    continueAfterDelete(appleAccessNeedsRevocation);
  };
  const signOut = async () => {
    if (busy) return;
    setError(null); setBusy('signout');
    const result = await auth.signOut();
    if (result.error) setError(t(locale, 'errors.generic'));
    setBusy(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{
        title: t(locale, 'settings.title'),
        headerBackButtonDisplayMode: 'default',
        headerBackTitle: t(locale, from === 'atlas' ? 'tabs.atlas' : 'tabs.home'),
      }} />

      <SettingsSection title={t(locale, 'settings.preferences')}>
        <SettingsRow icon={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} label={t(locale, 'settings.personalize')} detail={t(locale, 'settings.personalizeHint')} onPress={() => router.push('/onboarding')} />
        <SettingsRow icon={{ ios: 'character.bubble.fill', android: 'language', web: 'language' }} label={t(locale, 'settings.language')} value={preferences.locale === 'de' ? 'Deutsch' : 'English'} onPress={chooseLanguage} />
        <SettingsRow icon={{ ios: 'globe.europe.africa.fill', android: 'public', web: 'public' }} label={t(locale, 'settings.searchCountry')} value={preferences.country ? localizeCountry(locale, preferences.country) : '—'} onPress={chooseCountry} last />
      </SettingsSection>

      <SettingsSection title={t(locale, 'settings.account')}>
        {auth.session ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(auth.user?.email ?? 'A').slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.rowCopy}><Text style={styles.rowLabel}>{auth.user?.email}</Text><Text style={styles.rowDetail}>{t(locale, 'settings.account')}</Text></View>
            </View>
            <SettingsRow icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} label={busy === 'signout' ? t(locale, 'auth.signingOut') : t(locale, 'auth.signOut')} disabled={Boolean(busy)} onPress={() => void signOut()} />
            <SettingsRow icon={{ ios: 'doc.richtext.fill', android: 'picture_as_pdf', web: 'picture_as_pdf' }} label={busy === 'export-pdf' ? t(locale, 'settings.pdfExporting') : t(locale, 'settings.exportPdf')} detail={t(locale, 'settings.exportPdfHint')} disabled={Boolean(busy)} onPress={() => void exportPdf()} />
            <SettingsRow icon={{ ios: 'curlybraces.square.fill', android: 'data_object', web: 'data_object' }} label={busy === 'export-json' ? t(locale, 'settings.exporting') : t(locale, 'settings.exportJson')} detail={t(locale, 'settings.exportJsonHint')} disabled={Boolean(busy)} onPress={() => void exportData()} />
            <SettingsRow icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} label={busy === 'delete' ? t(locale, 'settings.deleting') : t(locale, 'settings.deleteAccount')} detail={t(locale, 'settings.deleteHint')} danger disabled={Boolean(busy)} onPress={confirmDelete} last />
          </>
        ) : (
          <SettingsRow icon={{ ios: 'person.crop.circle.badge.plus', android: 'login', web: 'login' }} label={t(locale, 'atlas.signIn')} detail={t(locale, 'settings.signInHint')} onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/settings' } })} last />
        )}
      </SettingsSection>

      <SettingsSection title={t(locale, 'settings.privacyLegal')}>
        <SettingsRow icon={{ ios: 'hand.raised.fill', android: 'privacy_tip', web: 'privacy_tip' }} label={t(locale, 'settings.privacy')} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)} />
        <SettingsRow icon={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} label={t(locale, 'settings.terms')} onPress={() => void Linking.openURL(LEGAL_URLS.terms)} />
        <SettingsRow icon={{ ios: 'building.2.fill', android: 'business', web: 'business' }} label={t(locale, 'settings.imprint')} onPress={() => openLegal('imprint')} last />
      </SettingsSection>

      <SettingsSection title={t(locale, 'settings.support')}>
        <SettingsRow icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }} label={t(locale, 'settings.contact')} onPress={() => void Linking.openURL('mailto:hello@estopia.net?subject=Apprentice%20Atlas%20Support')} />
        <SettingsRow icon={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} label={t(locale, 'settings.about')} onPress={() => openLegal('about')} />
        <SettingsRow icon={{ ios: 'app.badge.fill', android: 'apps', web: 'apps' }} label={t(locale, 'settings.version')} value={Constants.expoConfig?.version ?? '1.0.0'} last />
      </SettingsSection>

      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Text style={styles.company}>Apprentice Atlas · Estopia Engineering Ltd</Text>
    </ScrollView>
  );
}

function openLegal(document: 'privacy' | 'terms' | 'imprint' | 'about') {
  router.push({ pathname: '/legal/[document]', params: { document } } as never);
}

function SettingsSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.group}>{children}</View></View>;
}

function SettingsRow({ danger, detail, disabled, icon, label, last, onPress, value }: {
  danger?: boolean; detail?: string; disabled?: boolean; icon: AppIconName; label: string; last?: boolean; onPress?: () => void; value?: string;
}) {
  const content = (
    <>
      <View style={[styles.icon, danger && styles.dangerIcon]}><AppIcon name={icon} size={18} tintColor={danger ? Palette.danger : Palette.blue} /></View>
      <View style={styles.rowCopy}><Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>{detail && <Text style={styles.rowDetail}>{detail}</Text>}</View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={Palette.textSecondary} />}
    </>
  );
  const rowStyle = [styles.row, !last && styles.divider, disabled && styles.disabled];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [rowStyle, pressed && styles.pressed]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 64, gap: 24 },
  section: { gap: 8 },
  sectionTitle: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 4 },
  group: { overflow: 'hidden', borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.white, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  row: { minHeight: 58, paddingVertical: 9, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  dangerIcon: { backgroundColor: '#FFF0F0' },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { color: Palette.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowDetail: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17 },
  rowValue: { maxWidth: '38%', color: Palette.textSecondary, fontSize: 14, textAlign: 'right' },
  dangerText: { color: Palette.danger },
  accountRow: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Palette.white, fontSize: 17, fontWeight: '800' },
  error: { color: Palette.danger, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  company: { color: Palette.textSecondary, fontSize: 12, textAlign: 'center' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.68 },
});
