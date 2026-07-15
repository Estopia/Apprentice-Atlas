import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Palette } from '@/constants/theme';
import {
  getReadableAuthError,
  sendMagicLink,
  signInWithAppleIdToken,
  type AuthError,
} from '@/lib/auth';
import {
  getAppleControlPresentation,
  getEmailSubmissionState,
  submitEmailWhenValid,
} from '@/lib/auth-presentation';
import { t, useLocale } from '@/lib/i18n';

export function AuthForm({ onSuccess, redirectTo }: { onSuccess: () => void; redirectTo: string }) {
  const [locale] = useLocale();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<'email' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const emailSubmission = getEmailSubmissionState(email, Boolean(loadingMethod));
  const submitDisabled = !emailSubmission.canSubmit;
  const showInvalidEmail = emailTouched && email.trim().length > 0 && !emailSubmission.isValid;
  const appleControl = getAppleControlPresentation(loadingMethod);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => { active = false; };
  }, []);

  const submitEmail = async () => {
    setEmailTouched(true);
    if (loadingMethod || !emailSubmission.isValid) return;
    setLoadingMethod('email');
    setError(null);
    setSentTo(null);
    const submission = await submitEmailWhenValid(email, (normalizedEmail) => sendMagicLink(normalizedEmail, redirectTo));
    if (submission.result?.error) setError(submission.result.error);
    else if (submission.attempted) setSentTo(submission.normalizedEmail);
    setLoadingMethod(null);
  };

  const submitApple = async () => {
    if (loadingMethod) return;
    setLoadingMethod('apple');
    setError(null);
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      const result = await signInWithAppleIdToken({
        identityToken: credential.identityToken ?? '',
        authorizationCode: credential.authorizationCode,
        nonce: rawNonce,
        fullName: credential.fullName,
      });
      if (result.error) setError(result.error);
      else onSuccess();
    } catch (caught) {
      const code = typeof caught === 'object' && caught && 'code' in caught ? String(caught.code) : '';
      if (code !== 'ERR_REQUEST_CANCELED') {
        setError({ code: 'provider', message: caught instanceof Error ? caught.message : 'Apple sign-in failed.' });
      }
    } finally {
      setLoadingMethod(null);
    }
  };

  return (
    <View style={styles.form} accessibilityLabel={t(locale, 'auth.form')}>
      <View>
        <Text style={styles.label}>{t(locale, 'auth.email')}</Text>
        <TextInput
          accessibilityLabel={t(locale, 'auth.email')}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!loadingMethod}
          keyboardType="email-address"
          onBlur={() => setEmailTouched(true)}
          returnKeyType="send"
          textContentType="emailAddress"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setSentTo(null);
          }}
          onSubmitEditing={() => void submitEmail()}
          placeholder="you@example.com"
          placeholderTextColor={Palette.textSecondary}
          style={styles.input}
        />
        <Text accessibilityLiveRegion="polite" style={[styles.hint, showInvalidEmail && styles.validationError]}>
          {showInvalidEmail ? t(locale, 'auth.invalidEmail') : t(locale, 'auth.emailHint')}
        </Text>
      </View>

      {error && <Text accessibilityRole="alert" style={styles.error}>{getReadableAuthError(error, locale)}</Text>}
      {sentTo && (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeTitle}>{t(locale, 'auth.linkSent')}</Text>
          <Text style={styles.noticeCopy}>{t(locale, 'auth.linkSentHint')} {sentTo}</Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(locale, loadingMethod === 'email' ? 'auth.working' : sentTo ? 'auth.sendAgain' : 'auth.sendMagicLink')}
        accessibilityState={{ disabled: submitDisabled, busy: loadingMethod === 'email' }}
        disabled={submitDisabled}
        onPress={() => void submitEmail()}
        style={({ pressed }) => [styles.submit, pressed && !submitDisabled && styles.pressed, submitDisabled && styles.disabled]}
      >
        {loadingMethod === 'email'
          ? <ActivityIndicator color={Palette.white} />
          : <Text style={styles.submitText}>{t(locale, sentTo ? 'auth.sendAgain' : 'auth.sendMagicLink')}</Text>}
      </Pressable>

      {appleAvailable && (
        <>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t(locale, 'auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>
          <View pointerEvents={appleControl.accessibilityState.disabled ? 'none' : 'auto'} style={appleControl.accessibilityState.disabled && styles.disabled}>
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel={t(locale, appleControl.announceLoading ? 'auth.working' : 'auth.apple')}
              accessibilityState={appleControl.accessibilityState}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              cornerRadius={11}
              onPress={() => void submitApple()}
              style={styles.appleButton}
            />
          </View>
          {appleControl.announceLoading && (
            <View
              accessible
              accessibilityLabel={`${t(locale, 'auth.apple')}: ${t(locale, 'auth.working')}`}
              accessibilityLiveRegion="assertive"
              accessibilityRole="progressbar"
              style={styles.appleLoading}
            >
              <ActivityIndicator color={Palette.blue} size="small" />
              <Text style={styles.appleLoadingText}>{t(locale, 'auth.working')}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: 15 },
  label: { color: Palette.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { minHeight: 52, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: 12, paddingHorizontal: 15, color: Palette.text, fontSize: 16 },
  hint: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 7 },
  validationError: { color: Palette.danger },
  error: { color: Palette.danger, fontWeight: '600', lineHeight: 20 },
  notice: { padding: 13, borderRadius: 12, backgroundColor: Palette.blueSoft, gap: 3 },
  noticeTitle: { color: Palette.blueDark, fontSize: 15, fontWeight: '800' },
  noticeCopy: { color: Palette.textSecondary, fontSize: 13, lineHeight: 19 },
  submit: { minHeight: 52, backgroundColor: Palette.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: Palette.white, fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  dividerLine: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: Palette.border },
  dividerText: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600' },
  appleButton: { width: '100%', height: 52 },
  appleLoading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  appleLoadingText: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600' },
  pressed: { backgroundColor: Palette.bluePressed },
  disabled: { opacity: 0.55 },
});
