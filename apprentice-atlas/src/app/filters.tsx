import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { resetDiscoveryState, setDiscoveryFilters, setDiscoverySort, useDiscoveryState, type JobSort } from '@/lib/discovery-state';
import { getActiveFilterEntries, hasCoordinateLocation, transitionLocationFilter, type LocationFilterTransition } from '@/lib/filter-presentation';
import { localizeCategory, localizeCountry, localizeJobLevel, localizeJobType, t, useLocale, type Locale } from '@/lib/i18n';
import type { JobFilter } from '@/types/jobs';

const categories = ['technology', 'business', 'skilled-trades'];
const distances = [10, 25, 50, 100];

export default function FiltersSheet() {
  const [locale] = useLocale();
  const insets = useSafeAreaInsets();
  const { filters, sort } = useDiscoveryState();
  const activeEntries = getActiveFilterEntries(filters, sort);
  const update = (next: Partial<JobFilter>) => setDiscoveryFilters({ ...filters, ...next });
  const updateLocation = (action: LocationFilterTransition) => {
    const next = transitionLocationFilter({ filters, sort }, action);
    setDiscoveryFilters(next.filters);
    setDiscoverySort(next.sort);
  };
  const hasCoordinates = hasCoordinateLocation(filters);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {activeEntries.length > 0 && (
          <View style={styles.summary}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>{t(locale, 'discovery.activeFilters')}</Text>
              <Pressable
                accessibilityLabel={t(locale, 'discovery.resetFilters')}
                accessibilityRole="button"
                onPress={resetDiscoveryState}
                style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
              >
                <Text style={styles.resetText}>{t(locale, 'discovery.reset')}</Text>
              </Pressable>
            </View>
            <View accessibilityLabel={t(locale, 'discovery.activeFilters')} style={styles.activeChips}>
              {activeEntries.map((entry) => (
                <View key={`${entry.key}-${entry.value}`} style={styles.activeChip}>
                  <Text numberOfLines={1} style={styles.activeChipText}>{formatActiveFilter(locale, entry.key, entry.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <FilterSection title={t(locale, 'discovery.country')}>
          <Choice active={!filters.country} label={t(locale, 'discovery.all')} onPress={() => updateLocation({ type: 'select-country', country: undefined })} />
          <Choice active={filters.country === 'Germany'} label={localizeCountry(locale, 'Germany')} onPress={() => updateLocation({ type: 'select-country', country: 'Germany' })} />
          <Choice active={filters.country === 'United Kingdom'} label={localizeCountry(locale, 'United Kingdom')} onPress={() => updateLocation({ type: 'select-country', country: 'United Kingdom' })} />
        </FilterSection>

        <FilterSection title={t(locale, 'discovery.category')}>
          <Choice active={!filters.category} label={t(locale, 'discovery.all')} onPress={() => update({ category: undefined })} />
          {categories.map((category) => (
            <Choice key={category} active={filters.category === category} label={localizeCategory(locale, category)} onPress={() => update({ category })} />
          ))}
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
          <Choice active={!filters.radiusKm} label={t(locale, 'discovery.all')} onPress={() => updateLocation({ type: 'clear-radius' })} />
          {distances.map((distance) => (
            <Choice
              key={distance}
              active={filters.radiusKm === distance}
              disabled={!hasCoordinates}
              label={`${distance} km`}
              onPress={() => updateLocation({ type: 'set-radius', radiusKm: distance })}
            />
          ))}
          {!hasCoordinates && (
            <Text style={styles.hint}>{t(locale, 'discovery.distanceNeedsLocation')}</Text>
          )}
        </FilterSection>

        <FilterSection title={t(locale, 'discovery.sort')}>
          <Choice active={sort === 'recent'} label={t(locale, 'discovery.sortRecent')} onPress={() => updateLocation({ type: 'select-sort', sort: 'recent' })} />
          <Choice active={sort === 'distance'} disabled={!hasCoordinates} label={t(locale, 'discovery.sortDistance')} onPress={() => updateLocation({ type: 'select-sort', sort: 'distance' })} />
          <Choice active={sort === 'title'} label={t(locale, 'discovery.sortTitle')} onPress={() => updateLocation({ type: 'select-sort', sort: 'title' })} />
        </FilterSection>
      </ScrollView>

      <Stack.Screen options={{ title: t(locale, 'discovery.filters') }} />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityLabel={t(locale, 'discovery.showResults')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text style={styles.doneText}>{t(locale, 'discovery.showResults')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatActiveFilter(locale: Locale, key: string, value: string | number | JobSort): string {
  if (key === 'country') return localizeCountry(locale, String(value));
  if (key === 'category') return localizeCategory(locale, String(value));
  if (key === 'jobType') return localizeJobType(locale, String(value));
  if (key === 'level') return localizeJobLevel(locale, String(value));
  if (key === 'radiusKm') return `${value} km`;
  if (key === 'sort') {
    return t(locale, value === 'distance' ? 'discovery.sortDistance' : value === 'title' ? 'discovery.sortTitle' : 'discovery.sortRecent');
  }
  return String(value);
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View accessibilityRole="radiogroup" style={styles.choices}>{children}</View></View>;
}

function Choice({ active, disabled, label, onPress }: { active: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, active && styles.choiceActive, disabled && styles.choiceDisabled, pressed && styles.pressed]}
    >
      {active && <AppIcon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={15} tintColor={Palette.blue} />}
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16, paddingBottom: 118, gap: 22 },
  summary: { gap: 10, paddingBottom: 2 },
  summaryHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryTitle: { color: Palette.text, fontSize: 16, fontWeight: '700' },
  reset: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: Palette.textSecondary, fontSize: 14, fontWeight: '600' },
  activeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activeChip: { maxWidth: '100%', minHeight: 34, justifyContent: 'center', borderRadius: 17, backgroundColor: Palette.blueSoft, paddingHorizontal: 12 },
  activeChipText: { color: Palette.blue, fontSize: 13, fontWeight: '700' },
  section: { gap: 10 },
  sectionTitle: { color: Palette.text, fontSize: 15, fontWeight: '700', paddingHorizontal: 2 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Palette.white },
  choiceActive: { borderColor: Palette.blue, backgroundColor: Palette.blueSoft },
  choiceText: { color: Palette.text, fontSize: 15, fontWeight: '600' },
  choiceTextActive: { color: Palette.blue, fontWeight: '700' },
  choiceDisabled: { opacity: 0.38 },
  hint: { width: '100%', color: Palette.textSecondary, fontSize: 13, lineHeight: 18, paddingHorizontal: 2, paddingTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: Palette.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  done: { minHeight: 52, width: '100%', maxWidth: 648, alignSelf: 'center', borderRadius: 14, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
