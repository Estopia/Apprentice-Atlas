import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/app-icon';
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
  const [expanded, setExpanded] = useState(true);

  const ask = async () => {
    if (!question.trim() || count >= 2 || loading) return;
    setLoading(true); setError(null);
    const result = await askJobQuestion(jobId, locale, question.trim(), count, sessionId);
    if (result.error) setError(t(locale, 'errors.aiUnavailable'));
    else if (result.data) { setAnswer(result.data); setCount((value) => value + 1); setQuestion(''); }
    setLoading(false);
  };
  const limited = count >= 2;
  const counterText = limited ? t(locale, 'ai.limitReached') : count === 0 ? t(locale, 'ai.questionsAvailable') : t(locale, 'ai.oneQuestionAvailable');

  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t(locale, 'ai.askQuestion')}. ${counterText}`} accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.headingRow, pressed && styles.pressed]}>
        <View style={styles.headingCopy}><Text style={styles.heading}>{t(locale, 'ai.askQuestion')}</Text><Text style={styles.counter}>{counterText}</Text></View>
        <AppIcon name={{ ios: expanded ? 'chevron.up' : 'chevron.down', android: expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down', web: expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }} size={19} tintColor={Palette.textSecondary} />
      </Pressable>
      {expanded && <Animated.View entering={FadeInDown.duration(180)} style={styles.form}>
        <TextInput accessibilityLabel={t(locale, 'ai.questionPlaceholder')} editable={!limited && !loading} value={question} onChangeText={setQuestion} placeholder={t(locale, 'ai.questionPlaceholder')} placeholderTextColor={Palette.textSecondary} maxLength={300} style={styles.input} multiline />
        <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'ai.ask')} accessibilityState={{ disabled: limited || loading || !question.trim() }} disabled={limited || loading || !question.trim()} onPress={() => void ask()} style={[styles.button, (limited || loading || !question.trim()) && styles.disabled]}>{loading ? <ActivityIndicator color={Palette.white} /> : <Text style={styles.buttonText}>{t(locale, 'ai.ask')}</Text>}</Pressable>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {answer && <View style={styles.answer}><Text selectable style={styles.answerText}>{answer.notSpecified ? t(locale, 'ai.unknown') : answer.answer}</Text></View>}
      </Animated.View>}
    </View>
  );
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const random = Math.random() * 16 | 0; const value = character === 'x' ? random : random & 3 | 8; return value.toString(16); });
}
const clientSessionId = createSessionId();

const styles = StyleSheet.create({
  section: { paddingTop: 28 },
  headingRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, minWidth: 0 },
  heading: { color: Palette.text, fontWeight: '700', fontSize: 21 },
  counter: { color: Palette.textSecondary, fontSize: 13, fontWeight: '500', marginTop: 3, fontVariant: ['tabular-nums'] },
  form: { paddingTop: 2 },
  input: { minHeight: 104, marginTop: 8, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white, borderRadius: 14, borderCurve: 'continuous', padding: 14, color: Palette.text, fontSize: 15, textAlignVertical: 'top' },
  button: { alignSelf: 'flex-end', minHeight: 44, minWidth: 44, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 18, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  disabled: { opacity: 0.4 },
  buttonText: { color: Palette.white, fontWeight: '700' },
  error: { color: Palette.danger, marginTop: 10 },
  answer: { marginTop: 14, backgroundColor: Palette.surface, borderRadius: 12, borderCurve: 'continuous', padding: 14 },
  answerText: { color: Palette.text, lineHeight: 21 },
  pressed: { opacity: 0.72 },
});
