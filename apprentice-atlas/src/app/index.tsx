import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import JobMap from '@/components/map/job-map';
import { JobCard } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import { useJobs } from '@/hooks/use-jobs';
import { useLocation } from '@/hooks/use-location';
import { localizeJobError, useLocale, setLocale, t, type Locale } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/jobs';
import type { JobFilter } from '@/types/jobs';

export default function DiscoveryScreen() {
  const [locale] = useLocale();
  const [filters, setFilters] = useState<JobFilter>({});
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [manualCity, setManualCity] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const { jobs, loading, error, reload } = useJobs(filters);
  const location = useLocation();
  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);

  const useDeviceLocation = async () => {
    const next = await location.requestLocation();
    if (next && 'latitude' in next) setFilters((current) => ({ ...current, latitude: next.latitude, longitude: next.longitude, radiusKm: current.radiusKm ?? 50 }));
  };
  const useManual = () => {
    if (location.setManualLocation(manualCity, manualCountry)) setFilters((current) => ({ ...current, city: manualCity.trim(), country: manualCountry.trim(), latitude: undefined, longitude: undefined }));
  };

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><View style={styles.heading}><Text style={styles.eyebrow}>APPRENTICE ATLAS</Text><Text style={styles.title}>{t(locale, 'discovery.title')}</Text><Text style={styles.subtitle}>{t(locale, 'discovery.subtitle')}</Text></View><LanguageSwitcher locale={locale} /></View><View style={styles.locationPanel}><Text style={styles.panelTitle}>{t(locale, 'discovery.location')}</Text><View style={styles.locationActions}><Pressable onPress={useDeviceLocation} style={styles.primaryButton}><Text style={styles.primaryText}>{t(locale, 'location.useLocation')}</Text></Pressable><View style={styles.manualInputs}><TextInputLike value={manualCity} onChange={setManualCity} placeholder={t(locale, 'discovery.city')} /><TextInputLike value={manualCountry} onChange={setManualCountry} placeholder={t(locale, 'discovery.country')} /><Pressable onPress={useManual} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t(locale, 'discovery.useManual')}</Text></Pressable></View></View><Text style={styles.status}>{location.status === 'denied' || location.status === 'unavailable' ? `${t(locale, 'location.fallback')} ${t(locale, 'location.denied')}` : location.status === 'requesting' ? t(locale, 'loading.jobs') : ''}</Text></View><JobFilters value={filters} onChange={setFilters} /><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t(locale, 'discovery.jobs')} {jobs.length ? `(${jobs.length})` : ''}</Text><Text style={styles.mapCount}>{jobs.filter(hasMapPosition).length} {t(locale, 'discovery.markers')}</Text></View>{loading ? <StatePanel text={t(locale, 'loading.jobs')} /> : error ? <StatePanel text={localizeJobError(locale, error.code)} action={t(locale, 'discovery.retry')} onPress={() => void reload()} /> : !jobs.length ? <StatePanel text={t(locale, 'discovery.noResults')} /> : <><View style={styles.mapWrap}><JobMap jobs={jobs} selectedJobId={selectedJobId} onSelect={(job) => setSelectedJobId(job.id)} /></View>{selectedJob && <Text style={styles.selectedHint}>{t(locale, 'discovery.selectJob')}: {selectedJob.title}</Text>}<View style={styles.list}>{jobs.map((job) => <JobCard key={job.id} job={job} selected={job.id === selectedJobId} onPress={() => setSelectedJobId(job.id)} />)}</View></>}</ScrollView></SafeAreaView>;
}

function LanguageSwitcher({ locale }: { locale: Locale }) { return <View style={styles.language}><LanguageButton active={locale === 'de'} label="DE" onPress={() => setLocale('de')} /><LanguageButton active={locale === 'en'} label="EN" onPress={() => setLocale('en')} /></View>; }
function LanguageButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.langButton, active && styles.langActive]}><Text style={[styles.langText, active && styles.langActiveText]}>{label}</Text></Pressable>; }
function TextInputLike({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) { return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} style={styles.smallInput} />; }
function StatePanel({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) { return <View style={styles.state}><Text style={styles.stateText}>{text}</Text>{action && onPress && <Pressable onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryText}>{action}</Text></Pressable>}</View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f5f0' }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 100 }, header: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 24 }, heading: { flex: 1 }, eyebrow: { color: '#d95d39', fontWeight: '800', letterSpacing: 2, fontSize: 12 }, title: { color: '#173b35', fontSize: 34, lineHeight: 40, fontWeight: '800', marginTop: 8 }, subtitle: { color: '#53645f', fontSize: 16, lineHeight: 23, marginTop: 8 }, language: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: '#e8e4dd', borderRadius: 999, padding: 3 }, langButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 }, langActive: { backgroundColor: '#173b35' }, langText: { color: '#53645f', fontWeight: '800', fontSize: 12 }, langActiveText: { color: '#fff' }, locationPanel: { backgroundColor: '#173b35', borderRadius: 20, padding: 18 }, panelTitle: { color: '#fff', fontWeight: '800', fontSize: 17 }, locationActions: { marginTop: 12, gap: 12 }, manualInputs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, smallInput: { flexGrow: 1, minWidth: 100, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10 }, primaryButton: { alignSelf: 'flex-start', backgroundColor: '#f7c59f', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }, primaryText: { color: '#173b35', fontWeight: '800' }, secondaryButton: { backgroundColor: '#e9f1ed', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' }, secondaryText: { color: '#173b35', fontWeight: '800', fontSize: 12 }, status: { color: '#f7c59f', marginTop: 10, minHeight: 16 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 }, sectionTitle: { fontSize: 22, fontWeight: '800', color: '#173b35' }, mapCount: { color: '#53645f', fontSize: 12 }, mapWrap: { height: 280, marginBottom: 12 }, selectedHint: { color: '#d95d39', fontWeight: '700', marginBottom: 10 }, list: { gap: 2 }, state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 20 }, stateText: { color: '#53645f', textAlign: 'center' } });
