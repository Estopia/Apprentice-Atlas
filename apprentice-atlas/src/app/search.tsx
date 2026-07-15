import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';
import { updateDiscoveryFilters, useDiscoveryState } from '@/lib/discovery-state';
import { localizeCategory, localizeCountry, t, useLocale } from '@/lib/i18n';
import { clearRecentSearches, loadRecentSearches, normalizeRecentSearch, saveRecentSearch } from '@/lib/recent-searches';

const ALL_INTERESTS = ['technology', 'business', 'skilled-trades', 'general'];

export default function SearchScreen() {
  const router = useRouter();
  const [locale] = useLocale();
  const { preferences } = usePreferences();
  const { filters } = useDiscoveryState();
  const [query, setQuery] = useState(filters.search ?? '');
  const [category, setCategory] = useState<string | undefined>(filters.category);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const interests = useMemo(() => {
    const selected = preferences.interests.filter((interest) => ALL_INTERESTS.includes(interest));
    return selected.length ? selected : ALL_INTERESTS;
  }, [preferences.interests]);
  const normalizedQuery = normalizeRecentSearch(query);
  const canSubmit = Boolean(normalizedQuery || category);
  const country = filters.country ?? preferences.country ?? undefined;

  useEffect(() => {
    let active = true;
    void loadRecentSearches().then((items) => { if (active) setRecentSearches(items); });
    return () => { active = false; };
  }, []);

  const close = () => router.canGoBack() ? router.back() : router.replace('/');

  const submit = async (nextQuery = query) => {
    const search = normalizeRecentSearch(nextQuery);
    if (!search && !category) return;
    if (search) setRecentSearches(await saveRecentSearch(search));
    updateDiscoveryFilters({
      search: search || undefined,
      category,
      country: filters.latitude === undefined ? country : filters.country,
    });
    router.replace({ pathname: '/map', params: { view: 'list' } });
  };

  const clearHistory = async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <Stack.Screen
        options={{
          title: t(locale, 'search.title'),
          headerBackVisible: false,
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={close} style={styles.headerAction}>
              <Text style={styles.headerActionText}>{t(locale, 'search.cancel')}</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.searchField}>
        <AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={Palette.textSecondary} />
        <TextInput
          accessibilityLabel={t(locale, 'discovery.searchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          onSubmitEditing={() => void submit()}
          placeholder={t(locale, 'discovery.searchPlaceholder')}
          placeholderTextColor={Palette.textSecondary}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
      </View>

      <View style={styles.contextRow}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/location')} style={({ pressed }) => [styles.contextButton, pressed && styles.pressed]}>
          <AppIcon name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }} size={16} tintColor={Palette.blue} />
          <Text numberOfLines={1} style={styles.contextText}>{country ? localizeCountry(locale, country) : t(locale, 'discovery.location')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/filters')} style={({ pressed }) => [styles.contextButton, styles.filterButton, pressed && styles.pressed]}>
          <AppIcon name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} size={16} tintColor={Palette.blue} />
          <Text style={styles.contextText}>{t(locale, 'discovery.filtersShort')}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(locale, 'search.interests')}</Text>
        <View style={styles.chips}>
          {interests.map((interest) => {
            const selected = category === interest;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={interest}
                onPress={() => setCategory(selected ? undefined : interest)}
                style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{localizeCategory(locale, interest)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t(locale, 'search.recent')}</Text>
            <Pressable accessibilityRole="button" onPress={() => void clearHistory()} style={styles.clearButton}>
              <Text style={styles.clearText}>{t(locale, 'search.clear')}</Text>
            </Pressable>
          </View>
          <View style={styles.recents}>
            {recentSearches.map((item, index) => (
              <Pressable
                accessibilityRole="button"
                key={`${item}-${index}`}
                onPress={() => { setQuery(item); void submit(item); }}
                style={({ pressed }) => [styles.recentRow, index < recentSearches.length - 1 && styles.rowDivider, pressed && styles.pressed]}
              >
                <AppIcon name={{ ios: 'clock', android: 'history', web: 'history' }} size={17} tintColor={Palette.textSecondary} />
                <Text numberOfLines={1} style={styles.recentText}>{item}</Text>
                <AppIcon name={{ ios: 'arrow.up.left', android: 'north_west', web: 'north_west' }} size={15} tintColor={Palette.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={() => void submit()}
        style={({ pressed }) => [styles.submitButton, !canSubmit && styles.disabled, pressed && canSubmit && styles.pressed]}
      >
        <AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor={Palette.white} />
        <Text style={styles.submitText}>{t(locale, 'search.showResults')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48 },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  headerActionText: { color: Palette.blue, fontSize: 16, fontWeight: '600' },
  searchField: { minHeight: 56, borderRadius: Radius.medium, borderCurve: 'continuous', backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minHeight: 54, color: Palette.text, fontSize: 17 },
  contextRow: { flexDirection: 'row', gap: 10 },
  contextButton: { flex: 1, minWidth: 0, minHeight: 46, borderRadius: 14, borderCurve: 'continuous', backgroundColor: Palette.blueSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12 },
  filterButton: { flexGrow: 0, flexBasis: 112 },
  contextText: { flexShrink: 1, color: Palette.blueDark, fontSize: 14, fontWeight: '700' },
  section: { gap: 11 },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: Palette.text, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border },
  chipSelected: { backgroundColor: Palette.blue, borderColor: Palette.blue },
  chipText: { color: Palette.text, fontSize: 14, fontWeight: '700' },
  chipTextSelected: { color: Palette.white },
  clearButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { color: Palette.blue, fontSize: 14, fontWeight: '700' },
  recents: { overflow: 'hidden', borderRadius: Radius.medium, borderCurve: 'continuous', borderWidth: 1, borderColor: Palette.border },
  recentRow: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.white },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.border },
  recentText: { flex: 1, minWidth: 0, color: Palette.text, fontSize: 15 },
  submitButton: { minHeight: 52, borderRadius: 15, borderCurve: 'continuous', backgroundColor: Palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitText: { color: Palette.white, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
