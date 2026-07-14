import { StyleSheet, Text, View } from 'react-native';
import { useLocale, t } from '@/lib/i18n';
import type { JobExplanation } from '@/types/jobs';

export function AiExplanation({ explanation, loading, error }: { explanation: JobExplanation | null; loading?: boolean; error?: string | null }) {
  const [locale] = useLocale();
  return <View style={styles.card}><Text style={styles.heading}>{t(locale, 'ai.explanation')}</Text>{loading ? <Text style={styles.muted}>{t(locale, 'loading.ai')}</Text> : error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : explanation ? <><Text style={styles.summary}>{explanation.summary}</Text><Text style={styles.label}>{t(locale, 'ai.goodIf')}</Text>{explanation.goodIf.map((item) => <Text key={item} style={styles.item}>• {item}</Text>)}<Text style={styles.label}>{t(locale, 'ai.notSoGoodIf')}</Text>{explanation.notSoGoodIf.map((item) => <Text key={item} style={styles.item}>• {item}</Text>)}</> : null}</View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#e9f1ed', borderRadius: 18, padding: 18, marginTop: 16 }, heading: { color: '#173b35', fontWeight: '800', fontSize: 20 }, summary: { color: '#36534b', lineHeight: 22, marginTop: 12 }, label: { color: '#d95d39', fontWeight: '800', marginTop: 16 }, item: { color: '#36534b', lineHeight: 21, marginTop: 6 }, muted: { color: '#53645f', marginTop: 12 }, error: { color: '#a33d2b', marginTop: 12 } });
