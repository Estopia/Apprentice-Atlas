import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';
import { resetDiscoveryState, setDiscoveryFilters, setDiscoverySort, useDiscoveryState } from '@/lib/discovery-state';
import { localizeCategory, t, useLocale } from '@/lib/i18n';
import type { UserPreferences } from '@/lib/preferences';
import type { JobFilter } from '@/types/jobs';

const categories = ['technology', 'business', 'skilled-trades'];
const distances = [10, 25, 50, 100];

export default function FiltersSheet() {
  const [locale] = useLocale();
  const insets = useSafeAreaInsets();
  const { filters, sort } = useDiscoveryState();
  const { preferences, savePreferences } = usePreferences();
  const update = (next: Partial<JobFilter>) => setDiscoveryFilters({ ...filters, ...next });
  const updateLocale = (nextLocale: UserPreferences['locale']) => void savePreferences({ ...preferences, locale: nextLocale });

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <FilterSection title={t(locale, 'discovery.country')}>
          <Choice active={!filters.country} label={t(locale, 'discovery.all')} onPress={() => update({ country: undefined })} />
          <Choice active={filters.country === 'Germany'} label="Deutschland" onPress={() => update({ country: 'Germany' })} />
          <Choice active={filters.country === 'United Kingdom'} label="United Kingdom" onPress={() => update({ country: 'United Kingdom' })} />
        </FilterSection>
        <FilterSection title={t(locale, 'discovery.category')}>
          <Choice active={!filters.category} label={t(locale, 'discovery.all')} onPress={() => update({ category: undefined })} />
          {categories.map((category) => <Choice key={category} active={filters.category === category} label={localizeCategory(locale, category)} onPress={() => update({ category })} />)}
        </FilterSection>
        <FilterSection title={t(locale, 'discovery.opportunityType')}>
          <Choice active={!filters.jobType} label={t(locale, 'discovery.all')} onPress={() => update({ jobType: undefined })} />
          <Choice active={filters.jobType === 'apprenticeship'} label={t(locale, 'discovery.apprenticeship')} onPress={() => update({ jobType: 'apprenticeship' })} />
          <Choice active={filters.jobType === 'entry-level'} label={t(locale, 'discovery.entryLevel')} onPress={() => update({ jobType: 'entry-level' })} />
        </FilterSection>
        <FilterSection title={t(locale, 'discovery.level')}>
          <Choice active={!filters.level} label={t(locale, 'discovery.all')} onPress={() => update({ level: undefined })} />
          <Choice active={filters.level === 'entry-level'} label={t(locale, 'discovery.beginner')} onPress={() => update({ level: 'entry-level' })} />
        </FilterSection>
        <FilterSection title={t(locale, 'discovery.distance')}>
          <Choice active={!filters.radiusKm} label={t(locale, 'discovery.all')} onPress={() => update({ radiusKm: undefined })} />
          {distances.map((distance) => <Choice key={distance} active={filters.radiusKm === distance} disabled={filters.latitude === undefined || filters.longitude === undefined} label={`${distance} km`} onPress={() => update({ radiusKm: distance })} />)}
          {(filters.latitude === undefined || filters.longitude === undefined) && <Text style={styles.hint}>{t(locale, 'discovery.distanceNeedsLocation')}</Text>}
        </FilterSection>
        <FilterSection title={t(locale, 'discovery.sort')}>
          <Choice active={sort === 'recent'} label={t(locale, 'discovery.sortRecent')} onPress={() => setDiscoverySort('recent')} />
          <Choice active={sort === 'distance'} label={t(locale, 'discovery.sortDistance')} onPress={() => setDiscoverySort('distance')} />
          <Choice active={sort === 'title'} label={t(locale, 'discovery.sortTitle')} onPress={() => setDiscoverySort('title')} />
        </FilterSection>
        <FilterSection title={t(locale, 'discovery.language')}>
          <Choice active={locale === 'de'} label="Deutsch" onPress={() => updateLocale('de')} />
          <Choice active={locale === 'en'} label="English" onPress={() => updateLocale('en')} />
        </FilterSection>
        <Pressable accessibilityRole="button" onPress={resetDiscoveryState} style={styles.reset}><Text style={styles.resetText}>{t(locale, 'discovery.resetFilters')}</Text></Pressable>
      </ScrollView>
      <Stack.Screen options={{ title: t(locale, 'discovery.filters') }} />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.done, pressed && styles.pressed]}><Text style={styles.doneText}>{t(locale, 'actions.done')}</Text></Pressable></View>
    </>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.choices}>{children}</View></View>;
}

function Choice({ active, disabled, label, onPress }: { active: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choice, active && styles.choiceActive, disabled && styles.choiceDisabled, pressed && styles.pressed]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>{active && <AppIcon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={17} tintColor={Palette.blue} />}</Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { padding: 16, paddingBottom: 110, gap: 20 },
  section: { gap: 7 },
  sectionTitle: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
  choices: { backgroundColor: Palette.white, borderRadius: 14, overflow: 'hidden' },
  choice: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  choiceActive: { backgroundColor: Palette.blueSoft },
  choiceText: { flex: 1, color: Palette.text, fontSize: 16 },
  choiceTextActive: { color: Palette.blue, fontWeight: '600' },
  choiceDisabled: { opacity: 0.38 },
  hint: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, padding: 12 },
  reset: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: Palette.danger, fontSize: 16, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: Palette.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  done: { minHeight: 50, borderRadius: 12, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
