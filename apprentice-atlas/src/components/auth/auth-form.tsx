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
import { t, useLocale } from '@/lib/i18n';

export function AuthForm({ onSuccess, redirectTo }: { onSuccess: () => void; redirectTo: string }) {
  const [locale] = useLocale();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<AuthError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<'email' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let active = true;
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => { active = false; };
  }, []);

  const submitEmail = async () => {
    if (loadingMethod) return;
    setLoadingMethod('email');
    setError(null);
    setSentTo(null);
    const result = await sendMagicLink(email, redirectTo);
    if (result.error) setError(result.error);
    else setSentTo(email.trim().toLowerCase());
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
          keyboardType="email-address"
          returnKeyType="send"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => void submitEmail()}
          placeholder="you@example.com"
          placeholderTextColor={Palette.textSecondary}
          style={styles.input}
        />
        <Text style={styles.hint}>{t(locale, 'auth.emailHint')}</Text>
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
        accessibilityLabel={t(locale, 'auth.sendMagicLink')}
        disabled={Boolean(loadingMethod)}
        onPress={() => void submitEmail()}
        style={({ pressed }) => [styles.submit, pressed && styles.pressed, loadingMethod && styles.disabled]}
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
          <View style={[{ pointerEvents: loadingMethod ? 'none' : 'auto' }, loadingMethod && styles.disabled]}>
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel={t(locale, 'auth.apple')}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              cornerRadius={11}
              onPress={() => void submitApple()}
              style={styles.appleButton}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: 15 },
  label: { color: Palette.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { minHeight: 52, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: 12, paddingHorizontal: 15, color: Palette.text, fontSize: 16 },
  hint: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 7 },
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
  pressed: { backgroundColor: Palette.bluePressed },
  disabled: { opacity: 0.55 },
});
