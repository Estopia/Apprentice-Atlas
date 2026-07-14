import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { getReadableAuthError, signIn, signUp, type AuthError } from '@/lib/auth';
import { t, useLocale } from '@/lib/i18n';

export function AuthForm({ onSuccess }: { onSuccess: (mode: 'login' | 'signup') => void }) {
  const [locale] = useLocale();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setLoading(true); setError(null); setNotice(null);
    if (mode === 'login') {
      const result = await signIn(email, password);
      if (result.error) setError(result.error); else onSuccess(mode);
    } else {
      const result = await signUp(email, password);
      if (result.error) setError(result.error);
      else if (result.data?.needsEmailConfirmation) setNotice(t(locale, 'auth.confirmEmail'));
      else onSuccess(mode);
    }
    setLoading(false);
  };

  return (
    <View style={styles.form} accessibilityLabel={t(locale, 'auth.form')}>
      <View style={styles.switcher}><ModeButton active={mode === 'login'} label={t(locale, 'auth.login')} onPress={() => setMode('login')} /><ModeButton active={mode === 'signup'} label={t(locale, 'auth.signup')} onPress={() => setMode('signup')} /></View>
      <View><Text style={styles.label}>{t(locale, 'auth.email')}</Text><TextInput accessibilityLabel={t(locale, 'auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={Palette.textSecondary} style={styles.input} /></View>
      <View><Text style={styles.label}>{t(locale, 'auth.password')}</Text><TextInput accessibilityLabel={t(locale, 'auth.password')} secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={Palette.textSecondary} style={styles.input} /></View>
      {error && <Text accessibilityRole="alert" style={styles.error}>{getReadableAuthError(error, locale)}</Text>}
      {notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={mode === 'login' ? t(locale, 'auth.login') : t(locale, 'auth.signup')} disabled={loading} onPress={() => void submit()} style={({ pressed }) => [styles.submit, pressed && styles.pressed, loading && styles.disabled]}><Text style={styles.submitText}>{loading ? t(locale, 'auth.working') : mode === 'login' ? t(locale, 'auth.login') : t(locale, 'auth.signup')}</Text></Pressable>
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.mode, active && styles.modeActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: 15 },
  switcher: { flexDirection: 'row', padding: 3, backgroundColor: Palette.surface, borderRadius: 10, marginBottom: 2 },
  mode: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeActive: { backgroundColor: Palette.white, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  modeText: { color: Palette.textSecondary, fontWeight: '600' },
  modeTextActive: { color: Palette.blue },
  label: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 7 },
  input: { minHeight: 50, backgroundColor: Palette.surface, borderRadius: 11, paddingHorizontal: 14, color: Palette.text, fontSize: 16 },
  error: { color: Palette.danger, fontWeight: '600' },
  notice: { color: Palette.success, lineHeight: 20, fontWeight: '600' },
  submit: { minHeight: 50, backgroundColor: Palette.blue, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  submitText: { color: Palette.white, fontWeight: '700', fontSize: 16 },
  pressed: { backgroundColor: Palette.bluePressed },
  disabled: { opacity: 0.55 },
});
