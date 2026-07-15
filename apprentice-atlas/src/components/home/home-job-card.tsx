import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CompanyBrandMark } from '@/components/company/company-brand-mark';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { getCompanyBrand } from '@/lib/company-brand';
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
  const brand = getCompanyBrand(job.company);

  return (
    <Pressable
      accessibilityHint={t(locale, 'home.openJobHint')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={[styles.brandCover, { backgroundColor: brand.soft }]}>
        <Text accessibilityElementsHidden style={[styles.brandWatermark, { color: brand.accent }]}>{brand.initials}</Text>
        <CompanyBrandMark company={job.company} size={54} />
        <View style={styles.categoryPill}>
          <Text numberOfLines={1} style={styles.categoryText}>{localizeCategory(locale, job.category)}</Text>
        </View>
      </View>
      <View style={styles.body}>
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 278,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.white,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  brandCover: { height: 94, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, overflow: 'hidden' },
  brandWatermark: { position: 'absolute', right: -5, bottom: -31, fontSize: 96, lineHeight: 104, fontWeight: '900', opacity: 0.08, letterSpacing: -7 },
  categoryPill: { maxWidth: '62%', minHeight: 30, justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.82)', paddingHorizontal: 11 },
  categoryText: { color: Palette.textSecondary, fontSize: 12, fontWeight: '700' },
  body: { flex: 1, padding: 16, justifyContent: 'space-between' },
  copy: { gap: 5 },
  title: { minHeight: 46, color: Palette.text, fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.25 },
  company: { color: Palette.textSecondary, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  meta: { flex: 1, color: Palette.textSecondary, fontSize: 13, lineHeight: 18 },
  footer: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  jobType: { flex: 1, color: Palette.blueDark, fontSize: 13, fontWeight: '700' },
  openCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
