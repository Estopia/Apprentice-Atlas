import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { askJobQuestion } from '@/lib/ai';
import { t, useLocale } from '@/lib/i18n';
import type { JobQuestionAnswer } from '@/types/jobs';

export function JobQa({ jobId }: { jobId: string }) {
  const [locale] = useLocale();
  const sessionId = clientSessionId;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<JobQuestionAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const ask = async () => {
    if (!question.trim() || count >= 2 || loading) return;
    setLoading(true); setError(null);
    const result = await askJobQuestion(jobId, locale, question.trim(), count, sessionId);
    if (result.error) setError(t(locale, 'errors.aiUnavailable'));
    else if (result.data) { setAnswer(result.data); setCount((value) => value + 1); setQuestion(''); }
    setLoading(false);
  };
  const limited = count >= 2;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}><Text style={styles.heading}>{t(locale, 'ai.askQuestion')}</Text><Text style={styles.counter}>{limited ? t(locale, 'ai.limitReached') : locale === 'de' ? `${2 - count} übrig` : `${2 - count} left`}</Text></View>
      <TextInput accessibilityLabel={t(locale, 'ai.questionPlaceholder')} editable={!limited && !loading} value={question} onChangeText={setQuestion} placeholder={t(locale, 'ai.questionPlaceholder')} placeholderTextColor={Palette.textSecondary} maxLength={300} style={styles.input} multiline />
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'ai.ask')} accessibilityState={{ disabled: limited || loading || !question.trim() }} disabled={limited || loading || !question.trim()} onPress={() => void ask()} style={[styles.button, (limited || loading || !question.trim()) && styles.disabled]}>{loading ? <ActivityIndicator color={Palette.white} /> : <Text style={styles.buttonText}>{t(locale, 'ai.ask')}</Text>}</Pressable>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {answer && <View style={styles.answer}><Text selectable style={styles.answerText}>{answer.notSpecified ? t(locale, 'ai.unknown') : answer.answer}</Text></View>}
    </View>
  );
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const random = Math.random() * 16 | 0; const value = character === 'x' ? random : random & 3 | 8; return value.toString(16); });
}
const clientSessionId = createSessionId();

const styles = StyleSheet.create({
  card: { paddingTop: 24 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { color: Palette.text, fontWeight: '700', fontSize: 21 },
  counter: { color: Palette.textSecondary, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  input: { minHeight: 92, marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border, backgroundColor: Palette.surface, borderRadius: 12, borderCurve: 'continuous', padding: 14, color: Palette.text, textAlignVertical: 'top' },
  button: { alignSelf: 'flex-end', minHeight: 44, minWidth: 44, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 18, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  disabled: { opacity: 0.4 },
  buttonText: { color: Palette.white, fontWeight: '700' },
  error: { color: Palette.danger, marginTop: 10 },
  answer: { marginTop: 14, backgroundColor: Palette.surface, borderRadius: 12, borderCurve: 'continuous', padding: 14 },
  answerText: { color: Palette.text, lineHeight: 21 },
});
