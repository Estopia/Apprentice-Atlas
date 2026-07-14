import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { hasMapPosition } from '@/lib/job-filters';
import { localizeCategory, t, useLocale } from '@/lib/i18n';
import type { Job } from '@/types/jobs';

export function JobCard({ job, selected, onPress }: { job: Job; selected?: boolean; onPress: () => void }) {
  const [locale] = useLocale();
  const iconName = job.category === 'technology'
    ? { ios: 'chevron.left.forwardslash.chevron.right' as const, android: 'code' as const, web: 'code' as const }
    : job.category === 'business'
      ? { ios: 'briefcase.fill' as const, android: 'work' as const, web: 'work' as const }
      : { ios: 'wrench.and.screwdriver.fill' as const, android: 'construction' as const, web: 'construction' as const };
  const accent = job.category === 'technology' ? Palette.blue : job.category === 'business' ? Palette.coral : Palette.lime;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`} accessibilityState={{ selected }} onPress={onPress} style={[styles.card, selected && styles.selected, Shadows.subtle]}>
      <View style={[styles.icon, { backgroundColor: accent }]}><AppIcon name={iconName} size={22} tintColor={Palette.white} /></View>
      <View style={styles.copy}>
        <Text style={styles.category}>{localizeCategory(locale, job.category)}</Text>
        <Text style={styles.title} numberOfLines={2}>{job.title}</Text>
        <Text style={styles.company} numberOfLines={1}>{job.company}</Text>
        <View style={styles.locationRow}>
          <AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={14} tintColor={Palette.textSecondary} />
          <Text style={styles.location} numberOfLines={1}>{job.city}, {job.country}</Text>
          {!hasMapPosition(job) && <Text style={styles.nationwide}>{t(locale, 'discovery.nationwide')}</Text>}
        </View>
        <View style={styles.tags}>{job.tags.slice(0, 2).map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
      </View>
      <View style={styles.arrow}><AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={Palette.blue} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.white, borderRadius: Radius.large, padding: 15, borderWidth: 1, borderColor: Palette.border, minHeight: 132, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  selected: { borderColor: Palette.blue, backgroundColor: '#FBFDFF' },
  icon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  category: { color: Palette.blue, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '900', color: Palette.blueDark, marginTop: 4 },
  company: { color: Palette.text, fontWeight: '700', fontSize: 13, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  location: { color: Palette.textSecondary, fontSize: 12, flexShrink: 1 },
  nationwide: { color: Palette.blue, fontSize: 10, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  tag: { backgroundColor: Palette.blueSoft, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, color: Palette.blueDark, fontWeight: '700' },
  arrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
