import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';
import { localizeCategory, t, useLocale } from '@/lib/i18n';
import type { JobFilter } from '@/types/jobs';

const categories = ['technology', 'business', 'skilled-trades'];
const distances = [10, 25, 50, 100];

export function JobFilters({ value, onChange }: { value: JobFilter; onChange: (value: JobFilter) => void }) {
  const [locale] = useLocale();
  return (
    <View style={styles.container} accessibilityLabel={t(locale, 'discovery.filters')}>
      <View style={styles.inputs}>
        <TextInput accessibilityLabel={t(locale, 'discovery.city')} value={value.city ?? ''} onChangeText={(city) => onChange({ ...value, city: city || undefined })} placeholder={t(locale, 'discovery.city')} placeholderTextColor={Palette.textSecondary} style={styles.input} />
        <TextInput accessibilityLabel={t(locale, 'discovery.country')} value={value.country ?? ''} onChangeText={(country) => onChange({ ...value, country: country || undefined })} placeholder={t(locale, 'discovery.country')} placeholderTextColor={Palette.textSecondary} style={styles.input} />
      </View>
      <Text style={styles.label}>{t(locale, 'discovery.category')}</Text>
      <View style={styles.chips}>
        <FilterChip active={!value.category} label={t(locale, 'discovery.all')} onPress={() => onChange({ ...value, category: undefined })} />
        {categories.map((category) => <FilterChip key={category} active={value.category === category} label={localizeCategory(locale, category)} onPress={() => onChange({ ...value, category })} />)}
      </View>
      <Text style={styles.label}>{t(locale, 'discovery.distance')}</Text>
      <View style={styles.chips}>
        <FilterChip active={!value.radiusKm} label={t(locale, 'discovery.all')} onPress={() => onChange({ ...value, radiusKm: undefined })} />
        {distances.map((distance) => <FilterChip key={distance} active={value.radiusKm === distance} label={`${distance} km`} onPress={() => onChange({ ...value, radiusKm: distance })} />)}
      </View>
    </View>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  inputs: { flexDirection: 'row', gap: 9 },
  input: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: Palette.border, borderRadius: 15, paddingHorizontal: 13, color: Palette.text, backgroundColor: Palette.surface },
  label: { color: Palette.blueDark, fontSize: 12, fontWeight: '900', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 40, minWidth: 44, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.pill, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border },
  active: { backgroundColor: Palette.blue, borderColor: Palette.blue },
  chipText: { color: Palette.blueDark, fontSize: 12, fontWeight: '800' },
  activeText: { color: Palette.white },
});
