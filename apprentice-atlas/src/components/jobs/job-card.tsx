import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { hasMapPosition } from '@/lib/job-filters';
import { localizeCountry, localizeJobType, t, useLocale } from '@/lib/i18n';
import type { Job } from '@/types/jobs';

export function JobCard({ job, selected, onPress }: { job: Job; selected?: boolean; onPress: () => void }) {
  const [locale] = useLocale();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}>
      <View style={styles.logo}><Text style={styles.logoText}>{job.company.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{job.title}</Text>
        <Text style={styles.company} numberOfLines={1}>{job.company}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>{job.city}, {localizeCountry(locale, job.country)} · {localizeJobType(locale, job.jobType)}</Text>
          {!hasMapPosition(job) && <Text style={styles.nationwide}>{t(locale, 'discovery.nationwide')}</Text>}
        </View>
        {job.tags.length > 0 && <Text style={styles.tags} numberOfLines={1}>{job.tags.slice(0, 3).join(' · ')}</Text>}
      </View>
      <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={Palette.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 112, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  selected: { backgroundColor: '#F8FAFF' },
  pressed: { opacity: 0.65 },
  logo: { width: 46, height: 46, borderRadius: 11, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: Palette.blue, fontSize: 18, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: Palette.text, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  company: { color: Palette.text, fontSize: 14, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  meta: { flexShrink: 1, color: Palette.textSecondary, fontSize: 12 },
  nationwide: { color: Palette.blue, fontSize: 11, fontWeight: '600' },
  tags: { color: Palette.textSecondary, fontSize: 11, marginTop: 5 },
});
