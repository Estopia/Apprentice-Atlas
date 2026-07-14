import { useEffect, useMemo, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/jobs';
import { getJobsMapRegion } from '@/lib/map-region';
import type { Job } from '@/types/jobs';

export type JobMapProps = { jobs: Job[]; selectedJobId?: string; onSelect: (job: Job) => void; onRegionChange?: (center: { latitude: number; longitude: number }) => void };
type MappedJob = Job & { latitude: number; longitude: number };

export default function JobMap({ jobs, selectedJobId, onSelect, onRegionChange }: JobMapProps) {
  const [locale] = useLocale();
  const mapRef = useRef<MapView>(null);
  const ignoreNextRegionChange = useRef(true);
  const markers = jobs.filter(hasMapPosition) as MappedJob[];
  const region = useMemo(() => getJobsMapRegion(jobs), [jobs]);

  useEffect(() => {
    if (region) {
      ignoreNextRegionChange.current = true;
      mapRef.current?.animateToRegion(region, 350);
    }
  }, [region]);

  useEffect(() => {
    const selected = markers.find((job) => job.id === selectedJobId);
    if (selected) {
      ignoreNextRegionChange.current = true;
      mapRef.current?.animateCamera({ center: { latitude: selected.latitude, longitude: selected.longitude } }, { duration: 260 });
    }
  }, [markers, selectedJobId]);

  if (!region) return <View style={styles.empty} accessibilityLabel={t(locale, 'map.noPositions')}><Text style={styles.emptyText}>{t(locale, 'map.noPositions')}</Text></View>;

  return (
    <MapView
      ref={mapRef}
      accessibilityLabel={t(locale, 'map.markerList')}
      initialRegion={region}
      mapType="standard"
      pitchEnabled={false}
      rotateEnabled={false}
      onRegionChangeComplete={(next) => {
        if (ignoreNextRegionChange.current) {
          ignoreNextRegionChange.current = false;
          return;
        }
        onRegionChange?.({ latitude: next.latitude, longitude: next.longitude });
      }}
      showsCompass={false}
      showsMyLocationButton={false}
      style={styles.map}>
      {markers.map((job) => {
        const selected = job.id === selectedJobId;
        return (
          <Marker
            key={job.id}
            accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`}
            accessibilityState={{ selected }}
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: job.latitude, longitude: job.longitude }}
            pinColor={selected ? Palette.blueDark : Palette.blue}
            title={job.title}
            description={`${job.company} · ${job.city}`}
            onPress={() => onSelect(job)} />
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  emptyText: { color: Palette.textSecondary, textAlign: 'center', padding: 24 },
});
