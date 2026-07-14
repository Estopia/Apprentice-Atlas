import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale, t } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/jobs';
import type { JobMapProps } from './job-map';

export default function JobMap({ jobs, selectedJobId, onSelect }: JobMapProps) {
  const [locale] = useLocale();
  const markers = jobs.filter(hasMapPosition);
  return (
    <View style={styles.surface} accessibilityLabel={t(locale, 'map.markerList')}>
      <Text style={styles.title}>{t(locale, 'map.title')}</Text>
      <Text style={styles.hint}>{t(locale, 'map.webHelper')}</Text>
      <View style={styles.grid}>
        {markers.map((job) => <Pressable key={job.id} accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`} accessibilityState={{ selected: job.id === selectedJobId }} onPress={() => onSelect(job)} style={[styles.marker, job.id === selectedJobId && styles.selected]}><Text style={styles.pin}>●</Text><Text numberOfLines={1} style={styles.markerText}>{job.city}</Text></Pressable>)}
        {!markers.length && <Text style={styles.hint}>{t(locale, 'map.noPositions')}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ surface: { minHeight: 260, borderRadius: 20, padding: 20, backgroundColor: '#e9f1ed', justifyContent: 'center' }, title: { fontSize: 18, fontWeight: '700', color: '#173b35' }, hint: { marginTop: 6, color: '#53645f' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }, marker: { backgroundColor: '#fff', borderRadius: 14, minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%' }, selected: { backgroundColor: '#f7c59f' }, pin: { color: '#d95d39', fontSize: 20 }, markerText: { fontWeight: '600', color: '#173b35' } });
