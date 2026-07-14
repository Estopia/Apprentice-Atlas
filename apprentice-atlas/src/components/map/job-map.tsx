import MapView, { Marker } from 'react-native-maps';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLocale, t } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/jobs';
import { getJobsMapRegion } from '@/lib/map-region';
import type { Job } from '@/types/jobs';

export type JobMapProps = { jobs: Job[]; selectedJobId?: string; onSelect: (job: Job) => void };
type MappedJob = Job & { latitude: number; longitude: number };

export default function JobMap({ jobs, selectedJobId, onSelect }: JobMapProps) {
  const [locale] = useLocale();
  const mapRef = useRef<MapView>(null);
  const markers = jobs.filter(hasMapPosition) as MappedJob[];
  const region = useMemo(() => getJobsMapRegion(jobs), [jobs]);
  useEffect(() => {
    if (region) mapRef.current?.animateToRegion(region, 300);
  }, [region]);
  if (!region) return <View style={styles.empty} accessibilityLabel={t(locale, 'map.noPositions')}><Text>{t(locale, 'map.noPositions')}</Text></View>;
  return (
    <MapView ref={mapRef} style={styles.map} initialRegion={region} accessibilityLabel={t(locale, 'map.markerList')}>
      {markers.map((job) => <Marker key={job.id} coordinate={{ latitude: job.latitude, longitude: job.longitude }} title={job.title} description={job.company} accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`} accessibilityState={{ selected: job.id === selectedJobId }} pinColor={job.id === selectedJobId ? '#d95d39' : undefined} onPress={() => onSelect(job)} />)}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1, minHeight: 260, borderRadius: 20 }, empty: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center' } });
