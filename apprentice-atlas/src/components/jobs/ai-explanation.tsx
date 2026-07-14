import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import type { JobExplanation } from '@/types/jobs';

export function AiExplanation({ explanation, loading, error }: { explanation: JobExplanation | null; loading?: boolean; error?: string | null }) {
  const [locale] = useLocale();
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t(locale, 'ai.simpleWords')}</Text>
      {loading ? <View style={styles.loading}><ActivityIndicator color={Palette.blue} /><Text style={styles.muted}>{t(locale, 'loading.ai')}</Text></View> : error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : explanation ? <View style={styles.grouped}>
        <Text selectable style={styles.summary}>{explanation.summary}</Text>
        <View style={styles.separator} />
        <Text style={styles.goodLabel}>{t(locale, 'ai.goodIf')}</Text>
        {explanation.goodIf.map((item) => <Row key={item} item={item} symbol="✓" positive />)}
        <View style={styles.separator} />
        <Text style={styles.considerLabel}>{t(locale, 'ai.notSoGoodIf')}</Text>
        {explanation.notSoGoodIf.map((item) => <Row key={item} item={item} symbol="–" />)}
      </View> : null}
    </View>
  );
}

function Row({ item, positive, symbol }: { item: string; positive?: boolean; symbol: string }) {
  return <View style={styles.row}><Text style={[styles.symbol, positive && styles.symbolPositive]}>{symbol}</Text><Text selectable style={styles.item}>{item}</Text></View>;
}

const styles = StyleSheet.create({
  section: { paddingTop: 24 },
  heading: { color: Palette.text, fontSize: 21, fontWeight: '700', marginBottom: 10 },
  grouped: { backgroundColor: Palette.surface, borderRadius: 14, borderCurve: 'continuous', padding: 15 },
  summary: { color: Palette.text, fontSize: 15, lineHeight: 22 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border, marginVertical: 14 },
  goodLabel: { color: Palette.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  considerLabel: { color: Palette.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 7 },
  symbol: { width: 18, color: Palette.textSecondary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  symbolPositive: { color: Palette.blue },
  item: { flex: 1, color: Palette.text, fontSize: 14, lineHeight: 20 },
  loading: { minHeight: 90, borderRadius: 14, backgroundColor: Palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: Palette.textSecondary },
  error: { color: Palette.danger, lineHeight: 20 },
});
