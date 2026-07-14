import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
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
    if (result.error) setError(result.error.message);
    else if (result.data) { setAnswer(result.data); setCount((value) => value + 1); setQuestion(''); }
    setLoading(false);
  };
  const limited = count >= 2;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}><View style={styles.chatIcon}><AppIcon name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} size={20} tintColor={Palette.blue} /></View><View style={styles.headingCopy}><Text style={styles.heading}>{t(locale, 'ai.askQuestion')}</Text><Text style={styles.counter}>{limited ? t(locale, 'ai.limitReached') : `${2 - count} ${locale === 'de' ? 'Fragen übrig' : 'questions left'}`}</Text></View></View>
      <TextInput accessibilityLabel={t(locale, 'ai.questionPlaceholder')} editable={!limited && !loading} value={question} onChangeText={setQuestion} placeholder={t(locale, 'ai.questionPlaceholder')} placeholderTextColor={Palette.textSecondary} maxLength={300} style={styles.input} multiline />
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'ai.ask')} accessibilityState={{ disabled: limited || loading || !question.trim() }} disabled={limited || loading || !question.trim()} onPress={() => void ask()} style={[styles.button, (limited || loading || !question.trim()) && styles.disabled]}>{loading ? <ActivityIndicator color={Palette.white} /> : <><Text style={styles.buttonText}>{t(locale, 'ai.ask')}</Text><AppIcon name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={17} tintColor={Palette.white} /></>}</Pressable>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {answer && <View style={styles.answer}><Text style={styles.answerLabel}>ATLAS AI</Text><Text style={styles.answerText}>{answer.notSpecified ? t(locale, 'ai.unknown') : answer.answer}</Text></View>}
    </View>
  );
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const random = Math.random() * 16 | 0; const value = character === 'x' ? random : random & 3 | 8; return value.toString(16); });
}
const clientSessionId = createSessionId();

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.white, borderRadius: Radius.large, padding: 18, marginTop: 18, borderWidth: 1, borderColor: Palette.border },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  chatIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  heading: { color: Palette.blueDark, fontWeight: '900', fontSize: 18 },
  counter: { color: Palette.textSecondary, marginTop: 3, fontSize: 11, fontWeight: '700' },
  input: { minHeight: 92, marginTop: 15, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, borderRadius: Radius.medium, padding: 14, color: Palette.text, textAlignVertical: 'top' },
  button: { alignSelf: 'flex-end', minHeight: 44, minWidth: 44, borderRadius: 15, paddingHorizontal: 16, backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  disabled: { opacity: 0.4 },
  buttonText: { color: Palette.white, fontWeight: '900' },
  error: { color: Palette.danger, marginTop: 10 },
  answer: { marginTop: 16, backgroundColor: Palette.blueSoft, borderRadius: Radius.medium, padding: 14 },
  answerLabel: { color: Palette.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  answerText: { color: Palette.text, lineHeight: 21, marginTop: 6 },
});
