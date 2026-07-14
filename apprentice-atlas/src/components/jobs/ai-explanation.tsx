import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import type { JobExplanation } from '@/types/jobs';

export function AiExplanation({ explanation, loading, error }: { explanation: JobExplanation | null; loading?: boolean; error?: string | null }) {
  const [locale] = useLocale();
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.sparkle}><AppIcon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={20} tintColor={Palette.white} /></View>
        <View><Text style={styles.eyebrow}>ATLAS AI</Text><Text style={styles.heading}>{t(locale, 'ai.explanation')}</Text></View>
      </View>
      {loading ? <View style={styles.loading}><ActivityIndicator color={Palette.blue} /><Text style={styles.muted}>{t(locale, 'loading.ai')}</Text></View> : error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : explanation ? <><Text style={styles.summary}>{explanation.summary}</Text><View style={styles.columns}><View style={[styles.listCard, styles.goodCard]}><Text style={styles.goodLabel}>{t(locale, 'ai.goodIf')}</Text>{explanation.goodIf.map((item) => <Bullet key={item} item={item} positive />)}</View><View style={[styles.listCard, styles.considerCard]}><Text style={styles.considerLabel}>{t(locale, 'ai.notSoGoodIf')}</Text>{explanation.notSoGoodIf.map((item) => <Bullet key={item} item={item} />)}</View></View></> : null}
    </View>
  );
}

function Bullet({ item, positive }: { item: string; positive?: boolean }) {
  return <View style={styles.itemRow}><View style={[styles.bullet, positive ? styles.goodBullet : styles.considerBullet]} /><Text style={styles.item}>{item}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.blueSoft, borderRadius: Radius.large, padding: 18, marginTop: 18, borderWidth: 1, borderColor: '#D8E5FF' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sparkle: { width: 42, height: 42, borderRadius: 15, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: Palette.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heading: { color: Palette.blueDark, fontWeight: '900', fontSize: 19, marginTop: 2 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  summary: { color: Palette.text, lineHeight: 22, marginTop: 16, fontSize: 15 },
  columns: { gap: 10, marginTop: 16 },
  listCard: { borderRadius: 17, padding: 14, backgroundColor: Palette.white },
  goodCard: { borderLeftWidth: 4, borderLeftColor: Palette.success },
  considerCard: { borderLeftWidth: 4, borderLeftColor: Palette.coral },
  goodLabel: { color: Palette.success, fontWeight: '900', marginBottom: 7 },
  considerLabel: { color: Palette.coral, fontWeight: '900', marginBottom: 7 },
  itemRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 6 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  goodBullet: { backgroundColor: Palette.success },
  considerBullet: { backgroundColor: Palette.coral },
  item: { flex: 1, color: Palette.text, lineHeight: 19, fontSize: 13 },
  muted: { color: Palette.textSecondary },
  error: { color: Palette.danger, marginTop: 14 },
});
