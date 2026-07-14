import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { useLocation } from '@/hooks/use-location';
import { getDiscoveryState, setDiscoveryFilters } from '@/lib/discovery-state';
import { t, useLocale } from '@/lib/i18n';
import { applyDeviceLocationFilters, applyManualLocationFilters } from '@/lib/location';

export default function LocationSheet() {
  const [locale] = useLocale();
  const [city, setCity] = useState(getDiscoveryState().filters.city ?? '');
  const [country, setCountry] = useState(getDiscoveryState().filters.country ?? '');
  const location = useLocation();
  const manualValid = Boolean(city.trim() && country);

  const handleUseDevice = async () => {
    const next = await location.requestLocation();
    if (next && 'latitude' in next) {
      setDiscoveryFilters(applyDeviceLocationFilters(getDiscoveryState().filters, next.latitude, next.longitude));
      router.back();
    }
  };

  const useManual = () => {
    const next = applyManualLocationFilters(getDiscoveryState().filters, city, country);
    if (next) { setDiscoveryFilters(next); router.back(); }
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" disabled={location.status === 'requesting'} onPress={() => void handleUseDevice()} style={({ pressed }) => [styles.deviceRow, pressed && styles.pressed]}>
          <View style={styles.locationIcon}><AppIcon name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }} size={21} tintColor={Palette.white} /></View>
          <View style={styles.deviceCopy}><Text style={styles.deviceTitle}>{t(locale, 'location.useLocation')}</Text><Text style={styles.deviceDescription}>{t(locale, 'location.permissionDescription')}</Text></View>
          {location.status === 'requesting' ? <ActivityIndicator color={Palette.blue} /> : <Text style={styles.chevron}>›</Text>}
        </Pressable>
        <Text style={styles.label}>{t(locale, 'location.chooseLocation')}</Text>
        <View style={styles.fields}>
          <TextInput accessibilityLabel={t(locale, 'discovery.city')} value={city} onChangeText={setCity} onSubmitEditing={manualValid ? useManual : undefined} placeholder={t(locale, 'discovery.city')} placeholderTextColor={Palette.textSecondary} returnKeyType="done" style={styles.input} />
        </View>
        <Text style={styles.label}>{t(locale, 'discovery.country')}</Text>
        <View style={styles.fields}>
          <CountryChoice active={country === 'Germany'} label="Deutschland" onPress={() => setCountry('Germany')} />
          <View style={styles.separator} />
          <CountryChoice active={country === 'United Kingdom'} label="United Kingdom" onPress={() => setCountry('United Kingdom')} />
        </View>
        {(location.status === 'denied' || location.status === 'unavailable') && <Text accessibilityRole="alert" style={styles.error}>{t(locale, 'location.denied')} {t(locale, 'location.fallback')}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !manualValid }} disabled={!manualValid} onPress={useManual} style={({ pressed }) => [styles.apply, !manualValid && styles.disabled, pressed && styles.pressed]}><Text style={styles.applyText}>{t(locale, 'discovery.useManual')}</Text></Pressable>
      </ScrollView>
      <Stack.Screen options={{ title: t(locale, 'discovery.location') }} />
    </>
  );
}

function CountryChoice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.countryChoice, active && styles.countryChoiceActive, pressed && styles.pressed]}><Text style={[styles.countryText, active && styles.countryTextActive]}>{label}</Text>{active && <AppIcon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={17} tintColor={Palette.blue} />}</Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { padding: 16, gap: 18 },
  deviceRow: { minHeight: 76, backgroundColor: Palette.white, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  deviceCopy: { flex: 1, gap: 3 },
  deviceTitle: { color: Palette.text, fontSize: 16, fontWeight: '600' },
  deviceDescription: { color: Palette.textSecondary, fontSize: 13, lineHeight: 17 },
  chevron: { color: Palette.textSecondary, fontSize: 28, fontWeight: '300' },
  label: { color: Palette.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
  fields: { backgroundColor: Palette.white, borderRadius: 14, overflow: 'hidden' },
  input: { minHeight: 50, paddingHorizontal: 14, color: Palette.text, fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border, marginLeft: 14 },
  countryChoice: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  countryChoiceActive: { backgroundColor: Palette.blueSoft },
  countryText: { flex: 1, color: Palette.text, fontSize: 16 },
  countryTextActive: { color: Palette.blue, fontWeight: '600' },
  error: { color: Palette.danger, fontSize: 13, lineHeight: 18 },
  apply: { minHeight: 50, borderRadius: 12, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: Palette.white, fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
