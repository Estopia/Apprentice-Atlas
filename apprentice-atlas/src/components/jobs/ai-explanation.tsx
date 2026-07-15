import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import type { JobExplanation } from '@/types/jobs';

export function AiExplanation({ explanation, loading, error }: { explanation: JobExplanation | null; loading?: boolean; error?: string | null }) {
  const [locale] = useLocale();
  if (!error && !loading && !explanation) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t(locale, 'ai.simpleWords')}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.muted}>{error}</Text> : loading ? <View style={styles.loading}><ActivityIndicator color={Palette.blue} /><Text style={styles.muted}>{t(locale, 'loading.ai')}</Text></View> : explanation ? <>
        <View style={styles.summaryBlock}><Text selectable style={styles.summary}>{explanation.summary}</Text></View>
        <View style={styles.fitSection}>
          <Text style={styles.goodLabel}>{t(locale, 'ai.goodIf')}</Text>
          {explanation.goodIf.map((item) => <Row key={item} item={item} symbol="✓" positive />)}
        </View>
        <View style={styles.fitSection}>
          <Text style={styles.considerLabel}>{t(locale, 'ai.notSoGoodIf')}</Text>
          {explanation.notSoGoodIf.map((item) => <Row key={item} item={item} symbol="–" />)}
        </View>
      </> : null}
    </View>
  );
}

function Row({ item, positive, symbol }: { item: string; positive?: boolean; symbol: string }) {
  return <View style={styles.row}><Text style={[styles.symbol, positive && styles.symbolPositive]}>{symbol}</Text><Text selectable style={styles.item}>{item}</Text></View>;
}

const styles = StyleSheet.create({
  section: { paddingTop: 24 },
  heading: { color: Palette.text, fontSize: 21, fontWeight: '700', marginBottom: 10 },
  summaryBlock: { backgroundColor: Palette.blueSoft, borderRadius: 14, borderCurve: 'continuous', padding: 15 },
  summary: { color: Palette.text, fontSize: 16, lineHeight: 23 },
  fitSection: { paddingTop: 17 },
  goodLabel: { color: Palette.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  considerLabel: { color: Palette.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 7 },
  symbol: { width: 18, color: Palette.textSecondary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  symbolPositive: { color: Palette.blue },
  item: { flex: 1, color: Palette.text, fontSize: 15, lineHeight: 21 },
  loading: { minHeight: 90, borderRadius: 14, backgroundColor: Palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: Palette.textSecondary },
});
