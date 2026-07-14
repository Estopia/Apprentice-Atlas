import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { localizeCategory, useLocale, t } from '@/lib/i18n';
import type { JobFilter } from '@/types/jobs';

const categories = ['technology', 'business', 'skilled-trades'];
const distances = [10, 25, 50, 100];

export function JobFilters({ value, onChange }: { value: JobFilter; onChange: (value: JobFilter) => void }) {
  const [locale] = useLocale();
  return <View style={styles.container} accessibilityLabel={t(locale, 'discovery.filters')}><View style={styles.inputs}><TextInput accessibilityLabel={t(locale, 'discovery.city')} value={value.city ?? ''} onChangeText={(city) => onChange({ ...value, city })} placeholder={t(locale, 'discovery.city')} style={styles.input} /><TextInput accessibilityLabel={t(locale, 'discovery.country')} value={value.country ?? ''} onChangeText={(country) => onChange({ ...value, country })} placeholder={t(locale, 'discovery.country')} style={styles.input} /></View><Text style={styles.label}>{t(locale, 'discovery.category')}</Text><View style={styles.chips}>{<FilterChip active={!value.category} label={t(locale, 'discovery.all')} onPress={() => onChange({ ...value, category: undefined })} />}{categories.map((category) => <FilterChip key={category} active={value.category === category} label={localizeCategory(locale, category)} onPress={() => onChange({ ...value, category })} />)}</View><Text style={styles.label}>{t(locale, 'discovery.distance')}</Text><View style={styles.chips}><FilterChip active={!value.radiusKm} label={t(locale, 'discovery.all')} onPress={() => onChange({ ...value, radiusKm: undefined })} />{distances.map((distance) => <FilterChip key={distance} active={value.radiusKm === distance} label={`${distance} km`} onPress={() => onChange({ ...value, radiusKm: distance })} />)}</View></View>;
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ container: { gap: 10, paddingVertical: 12 }, inputs: { flexDirection: 'row', gap: 10 }, input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e1da', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44 }, label: { fontWeight: '700', color: '#36534b' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 999, backgroundColor: '#edf1ee' }, active: { backgroundColor: '#173b35' }, chipText: { color: '#36534b', fontWeight: '600' }, activeText: { color: '#fff' } });
