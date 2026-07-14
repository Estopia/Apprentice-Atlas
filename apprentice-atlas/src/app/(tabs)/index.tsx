import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JobCard } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import JobMap from '@/components/map/job-map';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius, Shadows } from '@/constants/theme';
import { useJobs } from '@/hooks/use-jobs';
import { useLocation, type LocationStatus } from '@/hooks/use-location';
import { localizeCategory, localizeJobError, setLocale, t, useLocale, type Locale } from '@/lib/i18n';
import { applyDeviceLocationFilters, applyManualLocationFilters } from '@/lib/location';
import type { Job, JobFilter } from '@/types/jobs';

type ViewMode = 'map' | 'list';

export default function DiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const [locale] = useLocale();
  const [filters, setFilters] = useState<JobFilter>({});
  const [search, setSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [manualCity, setManualCity] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showFilters, setShowFilters] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const { jobs, loading, error, reload } = useJobs(filters);
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, search: search.trim() || undefined }));
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId],
  );

  const handleUseDeviceLocation = async () => {
    const next = await location.requestLocation();
    if (next && 'latitude' in next) {
      setFilters((current) => applyDeviceLocationFilters(current, next.latitude, next.longitude));
      setManualCity('');
      setManualCountry('');
      setShowLocation(false);
    }
  };

  const useManualLocation = () => {
    const nextFilters = applyManualLocationFilters(filters, manualCity, manualCountry);
    if (nextFilters && location.setManualLocation(manualCity, manualCountry)) {
      setFilters(nextFilters);
      setShowLocation(false);
    }
  };

  const toggleFilters = () => {
    setShowLocation(false);
    setShowFilters((current) => !current);
  };

  const toggleLocation = () => {
    setShowFilters(false);
    setShowLocation((current) => !current);
  };

  const openJob = (job: Job) => router.push(`/job/${job.id}`);
  const activeFilterCount = [filters.category, filters.radiusKm, filters.city, filters.country].filter(Boolean).length;

  return (
    <View style={styles.screen}>
      {viewMode === 'map' ? (
        <JobMap jobs={jobs} selectedJobId={selectedJob?.id} onSelect={(job) => setSelectedJobId(job.id)} />
      ) : (
        <ScrollView
          style={styles.listScreen}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 174 }]}
          contentInsetAdjustmentBehavior="never">
          <View style={styles.listHeadingRow}>
            <View>
              <Text style={styles.listEyebrow}>{t(locale, 'discovery.results')}</Text>
              <Text style={styles.listTitle}>{jobs.length} {locale === 'de' ? t(locale, 'discovery.jobs') : t(locale, 'discovery.jobs').toLowerCase()}</Text>
            </View>
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{jobs.length}</Text></View>
          </View>
          {loading ? <StatePanel loading text={t(locale, 'loading.jobs')} /> : error ? <StatePanel text={localizeJobError(locale, error.code)} action={t(locale, 'discovery.retry')} onPress={() => void reload()} /> : !jobs.length ? <StatePanel text={t(locale, 'discovery.noResults')} /> : <View style={styles.cards}>{jobs.map((job) => <JobCard key={job.id} job={job} selected={job.id === selectedJob?.id} onPress={() => openJob(job)} />)}</View>}
        </ScrollView>
      )}

      <View pointerEvents="box-none" style={[styles.topControls, { top: insets.top + 10 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <AppIcon name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }} size={18} tintColor={Palette.white} />
            </View>
            <Text style={styles.brandText}>APPRENTICE ATLAS</Text>
          </View>
          <LanguageSwitcher locale={locale} />
        </View>

        <View style={[styles.searchBar, Shadows.floating]}>
          <AppIcon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={Palette.textSecondary} />
          <TextInput
            accessibilityLabel={t(locale, 'discovery.searchPlaceholder')}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            placeholder={t(locale, 'discovery.searchPlaceholder')}
            placeholderTextColor={Palette.textSecondary}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'discovery.filters')} onPress={toggleFilters} style={[styles.iconButton, showFilters && styles.iconButtonActive]}>
            <AppIcon name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} size={19} tintColor={showFilters ? Palette.white : Palette.blueDark} />
            {activeFilterCount > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={viewMode === 'map' ? t(locale, 'discovery.list') : t(locale, 'discovery.map')} onPress={() => setViewMode((current) => current === 'map' ? 'list' : 'map')} style={styles.iconButton}>
            <AppIcon name={viewMode === 'map' ? { ios: 'list.bullet', android: 'view_list', web: 'view_list' } : { ios: 'map.fill', android: 'map', web: 'map' }} size={19} tintColor={Palette.blueDark} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
          <QuickChip active={!filters.category} label={t(locale, 'discovery.all')} onPress={() => setFilters((current) => ({ ...current, category: undefined }))} />
          {['technology', 'business', 'skilled-trades'].map((category) => (
            <QuickChip key={category} active={filters.category === category} label={localizeCategory(locale, category)} onPress={() => setFilters((current) => ({ ...current, category }))} />
          ))}
        </ScrollView>
      </View>

      {showFilters && (
        <View style={[styles.popover, styles.filterPopover, { top: insets.top + 144 }, Shadows.floating]}>
          <View style={styles.popoverHeading}>
            <View><Text style={styles.popoverEyebrow}>{t(locale, 'discovery.refine')}</Text><Text style={styles.popoverTitle}>{t(locale, 'discovery.filters')}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.close')} onPress={() => setShowFilters(false)} style={styles.closeButton}>
              <AppIcon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={17} tintColor={Palette.blueDark} />
            </Pressable>
          </View>
          <JobFilters value={filters} onChange={setFilters} />
        </View>
      )}

      {showLocation && (
        <LocationPanel
          city={manualCity}
          country={manualCountry}
          locale={locale}
          onChangeCity={setManualCity}
          onChangeCountry={setManualCountry}
          onClose={() => setShowLocation(false)}
          onManual={useManualLocation}
          onUseDevice={() => void handleUseDeviceLocation()}
          status={location.status}
          top={insets.top + 144}
        />
      )}

      {viewMode === 'map' && (
        <View pointerEvents="box-none" style={[styles.mapFooter, { bottom: Math.max(insets.bottom, 12) + 72 }]}>
          <View style={styles.mapMetaRow}>
            <View style={[styles.resultsPill, Shadows.subtle]}>
              <View style={styles.liveDot} />
              <Text style={styles.resultsPillText}>{loading ? t(locale, 'loading.jobs') : `${jobs.length} ${t(locale, 'discovery.results').toLowerCase()}`}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'location.chooseLocation')} onPress={toggleLocation} style={[styles.locationButton, Shadows.floating]}>
              <AppIcon name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }} size={22} tintColor={Palette.blue} />
            </Pressable>
          </View>

          {loading ? <StatePanel compact loading text={t(locale, 'loading.jobs')} /> : error ? <StatePanel compact text={localizeJobError(locale, error.code)} action={t(locale, 'discovery.retry')} onPress={() => void reload()} /> : selectedJob ? <JobPreview job={selectedJob} locale={locale} onPress={() => openJob(selectedJob)} /> : <StatePanel compact text={t(locale, 'discovery.noResults')} />}
        </View>
      )}
    </View>
  );
}

function JobPreview({ job, locale, onPress }: { job: Job; locale: Locale; onPress: () => void }) {
  const categoryColor = job.category === 'technology' ? Palette.blue : job.category === 'business' ? Palette.coral : Palette.lime;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.company}`} onPress={onPress} style={[styles.preview, Shadows.floating]}>
      <View style={[styles.previewIcon, { backgroundColor: categoryColor }]}>
        <AppIcon name={{ ios: job.category === 'technology' ? 'chevron.left.forwardslash.chevron.right' : job.category === 'business' ? 'briefcase.fill' : 'wrench.and.screwdriver.fill', android: job.category === 'technology' ? 'code' : job.category === 'business' ? 'work' : 'construction', web: job.category === 'technology' ? 'code' : job.category === 'business' ? 'work' : 'construction' }} size={25} tintColor={Palette.white} />
      </View>
      <View style={styles.previewCopy}>
        <View style={styles.previewTopline}>
          <Text style={styles.previewCategory}>{localizeCategory(locale, job.category)}</Text>
          <Text style={styles.previewSource} numberOfLines={1}>{job.sourceName}</Text>
        </View>
        <Text style={styles.previewTitle} numberOfLines={2}>{job.title}</Text>
        <Text style={styles.previewCompany} numberOfLines={1}>{job.company}</Text>
        <View style={styles.previewLocationRow}>
          <AppIcon name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={15} tintColor={Palette.textSecondary} />
          <Text style={styles.previewLocation} numberOfLines={1}>{job.city}, {job.country}</Text>
        </View>
      </View>
      <View style={styles.previewArrow}>
        <AppIcon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={19} tintColor={Palette.white} />
      </View>
    </Pressable>
  );
}

function LocationPanel({ city, country, locale, onChangeCity, onChangeCountry, onClose, onManual, onUseDevice, status, top }: { city: string; country: string; locale: Locale; onChangeCity: (value: string) => void; onChangeCountry: (value: string) => void; onClose: () => void; onManual: () => void; onUseDevice: () => void; status: LocationStatus; top: number }) {
  return (
    <View style={[styles.popover, { top }, Shadows.floating]}>
      <View style={styles.popoverHeading}>
        <View><Text style={styles.popoverEyebrow}>{t(locale, 'discovery.nearby')}</Text><Text style={styles.popoverTitle}>{t(locale, 'discovery.location')}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'actions.close')} onPress={onClose} style={styles.closeButton}>
          <AppIcon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={17} tintColor={Palette.blueDark} />
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'location.useLocation')} disabled={status === 'requesting'} onPress={onUseDevice} style={styles.primaryAction}>
        {status === 'requesting' ? <ActivityIndicator color={Palette.white} /> : <AppIcon name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }} size={18} tintColor={Palette.white} />}
        <Text style={styles.primaryActionText}>{t(locale, 'location.useLocation')}</Text>
      </Pressable>
      <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>{t(locale, 'discovery.or')}</Text><View style={styles.divider} /></View>
      <View style={styles.manualRow}>
        <TextInput accessibilityLabel={t(locale, 'discovery.city')} onChangeText={onChangeCity} placeholder={t(locale, 'discovery.city')} placeholderTextColor={Palette.textSecondary} style={styles.locationInput} value={city} />
        <TextInput accessibilityLabel={t(locale, 'discovery.country')} onChangeText={onChangeCountry} placeholder={t(locale, 'discovery.country')} placeholderTextColor={Palette.textSecondary} style={styles.locationInput} value={country} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'discovery.useManual')} onPress={onManual} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{t(locale, 'discovery.useManual')}</Text></Pressable>
      {(status === 'denied' || status === 'unavailable') && <Text style={styles.locationStatus}>{t(locale, 'location.denied')} {t(locale, 'location.fallback')}</Text>}
    </View>
  );
}

function LanguageSwitcher({ locale }: { locale: Locale }) {
  return <View style={styles.language}><LanguageButton active={locale === 'de'} label="DE" onPress={() => setLocale('de')} /><LanguageButton active={locale === 'en'} label="EN" onPress={() => setLocale('en')} /></View>;
}

function LanguageButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label === 'DE' ? 'Deutsch' : 'English'} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.langButton, active && styles.langActive]}><Text style={[styles.langText, active && styles.langActiveText]}>{label}</Text></Pressable>;
}

function QuickChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.quickChip, active && styles.quickChipActive, Shadows.subtle]}><Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{label}</Text></Pressable>;
}

function StatePanel({ text, action, onPress, loading, compact }: { text: string; action?: string; onPress?: () => void; loading?: boolean; compact?: boolean }) {
  return <View style={[styles.state, compact && styles.stateCompact, Shadows.subtle]} accessibilityRole="alert">{loading && <ActivityIndicator color={Palette.blue} />}<Text style={styles.stateText}>{text}</Text>{action && onPress && <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={styles.retryButton}><Text style={styles.retryText}>{action}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background },
  listScreen: { flex: 1, backgroundColor: Palette.background },
  listContent: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 130 },
  listHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 16 },
  listEyebrow: { color: Palette.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  listTitle: { color: Palette.blueDark, fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 3 },
  countBadge: { width: 46, height: 46, borderRadius: 23, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: Palette.blue, fontWeight: '900', fontSize: 16 },
  cards: { gap: 10 },
  topControls: { position: 'absolute', left: 14, right: 14, gap: 10, zIndex: 20, maxWidth: 900, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: Radius.pill, paddingVertical: 6, paddingLeft: 6, paddingRight: 13 },
  logoMark: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: Palette.blueDark, fontWeight: '900', fontSize: 11, letterSpacing: 1.15 },
  language: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: Radius.pill, padding: 3 },
  langButton: { minHeight: 34, minWidth: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  langActive: { backgroundColor: Palette.blueDark },
  langText: { color: Palette.textSecondary, fontWeight: '800', fontSize: 11 },
  langActiveText: { color: Palette.white },
  searchBar: { height: 58, paddingLeft: 17, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.large, backgroundColor: Palette.white, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)' },
  searchInput: { flex: 1, height: '100%', color: Palette.text, fontSize: 16, fontWeight: '600' },
  iconButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface, position: 'relative' },
  iconButtonActive: { backgroundColor: Palette.blue },
  filterCount: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Palette.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Palette.white },
  filterCountText: { color: Palette.white, fontSize: 9, fontWeight: '900' },
  quickFilters: { gap: 8, paddingRight: 14 },
  quickChip: { minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.96)', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)' },
  quickChipActive: { backgroundColor: Palette.blueDark, borderColor: Palette.blueDark },
  quickChipText: { color: Palette.blueDark, fontSize: 13, fontWeight: '800' },
  quickChipTextActive: { color: Palette.white },
  popover: { position: 'absolute', left: 14, right: 14, zIndex: 30, maxWidth: 520, alignSelf: 'center', backgroundColor: Palette.white, borderRadius: Radius.large, padding: 18, borderWidth: 1, borderColor: Palette.border },
  filterPopover: { maxWidth: 600 },
  popoverHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  popoverEyebrow: { color: Palette.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  popoverTitle: { color: Palette.blueDark, fontSize: 22, fontWeight: '900', marginTop: 2 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' },
  primaryAction: { minHeight: 50, borderRadius: 16, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  primaryActionText: { color: Palette.white, fontWeight: '900', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: Palette.border },
  dividerText: { color: Palette.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  manualRow: { flexDirection: 'row', gap: 9 },
  locationInput: { flex: 1, minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, color: Palette.text, backgroundColor: Palette.surface },
  secondaryAction: { minHeight: 48, borderRadius: 15, backgroundColor: Palette.blueSoft, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryActionText: { color: Palette.blue, fontWeight: '900' },
  locationStatus: { color: Palette.danger, fontSize: 12, lineHeight: 18, marginTop: 10 },
  mapFooter: { position: 'absolute', left: 14, right: 14, zIndex: 15, maxWidth: 680, alignSelf: 'center', gap: 10 },
  mapMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultsPill: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.96)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.success },
  resultsPillText: { color: Palette.blueDark, fontSize: 12, fontWeight: '800' },
  locationButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  preview: { minHeight: 142, borderRadius: 26, padding: 16, backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  previewIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewCategory: { color: Palette.blue, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  previewSource: { flex: 1, color: Palette.textSecondary, fontSize: 10, textAlign: 'right' },
  previewTitle: { color: Palette.blueDark, fontSize: 19, lineHeight: 23, fontWeight: '900', marginTop: 5 },
  previewCompany: { color: Palette.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  previewLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  previewLocation: { flex: 1, color: Palette.textSecondary, fontSize: 12 },
  previewArrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: Palette.blue, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Palette.white, borderRadius: Radius.large, padding: 22 },
  stateCompact: { minHeight: 110, borderWidth: 1, borderColor: Palette.border },
  stateText: { color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 },
  retryButton: { minHeight: 42, paddingHorizontal: 15, borderRadius: 14, backgroundColor: Palette.blueSoft, justifyContent: 'center' },
  retryText: { color: Palette.blue, fontWeight: '900' },
});
