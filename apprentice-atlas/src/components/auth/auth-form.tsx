import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { signIn, signUp, getReadableAuthError, type AuthError } from '@/lib/auth';
import { useLocale, t } from '@/lib/i18n';

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

  return <View style={styles.form} accessibilityLabel={t(locale, 'auth.form')}>
    <View style={styles.switcher}><ModeButton active={mode === 'login'} label={t(locale, 'auth.login')} onPress={() => setMode('login')} /><ModeButton active={mode === 'signup'} label={t(locale, 'auth.signup')} onPress={() => setMode('signup')} /></View>
    <TextInput accessibilityLabel={t(locale, 'auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={t(locale, 'auth.email')} style={styles.input} />
    <TextInput accessibilityLabel={t(locale, 'auth.password')} secureTextEntry value={password} onChangeText={setPassword} placeholder={t(locale, 'auth.password')} style={styles.input} />
    {error && <Text accessibilityRole="alert" style={styles.error}>{getReadableAuthError(error, locale)}</Text>}
    {notice && <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={mode === 'login' ? t(locale, 'auth.login') : t(locale, 'auth.signup')} disabled={loading} onPress={() => void submit()} style={styles.submit}><Text style={styles.submitText}>{loading ? t(locale, 'auth.working') : mode === 'login' ? t(locale, 'auth.login') : t(locale, 'auth.signup')}</Text></Pressable>
  </View>;
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.mode, active && styles.modeActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ form: { width: '100%', maxWidth: 430, gap: 12 }, switcher: { flexDirection: 'row', gap: 8, marginBottom: 4 }, mode: { flex: 1, minHeight: 44, padding: 11, borderRadius: 10, backgroundColor: '#e9f1ed', alignItems: 'center', justifyContent: 'center' }, modeActive: { backgroundColor: '#173b35' }, modeText: { color: '#36534b', fontWeight: '800' }, modeTextActive: { color: '#fff' }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd7ce', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, minHeight: 44 }, error: { color: '#b33e2e' }, notice: { color: '#36534b' }, submit: { backgroundColor: '#d95d39', borderRadius: 10, alignItems: 'center', padding: 13, minHeight: 44, minWidth: 44, justifyContent: 'center' }, submitText: { color: '#fff', fontWeight: '800' } });
