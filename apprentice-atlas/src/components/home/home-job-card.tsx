import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { localizeCategory, localizeJobType, t, type Locale } from '@/lib/i18n';
import type { Job } from '@/types/jobs';

export function HomeJobCard({
  distanceKm,
  job,
  locale,
  onPress,
  width,
}: {
  distanceKm: number | null;
  job: Job;
  locale: Locale;
  onPress: () => void;
  width: number;
}) {
  const distance = distanceKm === null
    ? null
    : distanceKm < 10
      ? `${distanceKm.toFixed(1)} km`
      : `${Math.round(distanceKm)} km`;

  return (
    <Pressable
      accessibilityHint={t(locale, 'home.openJobHint')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.iconTile}>
          <AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={20} tintColor={Palette.blue} />
        </View>
        <View style={styles.categoryPill}>
          <Text numberOfLines={1} style={styles.categoryText}>{localizeCategory(locale, job.category)}</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>{job.title}</Text>
        <Text numberOfLines={1} style={styles.company}>{job.company}</Text>
      </View>
      <View style={styles.metaRow}>
        <AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={15} tintColor={Palette.textSecondary} />
        <Text numberOfLines={1} style={styles.meta}>{job.city}{distance ? ` · ${distance}` : ''}</Text>
      </View>
      <View style={styles.footer}>
        <Text numberOfLines={1} style={styles.jobType}>{localizeJobType(locale, job.jobType)}</Text>
        <View style={styles.openCircle}>
          <AppIcon name={{ ios: 'arrow.up.right', android: 'arrow_outward', web: 'arrow_outward' }} size={15} tintColor={Palette.blue} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 214,
    padding: 16,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.white,
    justifyContent: 'space-between',
    ...Shadows.subtle,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconTile: { width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  categoryPill: { maxWidth: '68%', minHeight: 30, justifyContent: 'center', borderRadius: 15, backgroundColor: Palette.surface, paddingHorizontal: 11 },
  categoryText: { color: Palette.textSecondary, fontSize: 12, fontWeight: '700' },
  copy: { gap: 5, marginTop: 14 },
  title: { minHeight: 46, color: Palette.text, fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.25 },
  company: { color: Palette.textSecondary, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  meta: { flex: 1, color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
  footer: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  jobType: { flex: 1, color: Palette.blueDark, fontSize: 13, fontWeight: '700' },
  openCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
