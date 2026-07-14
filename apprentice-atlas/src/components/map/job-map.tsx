import { useEffect, useMemo, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Shadows } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
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
    if (region) mapRef.current?.animateToRegion(region, 350);
  }, [region]);

  useEffect(() => {
    const selected = markers.find((job) => job.id === selectedJobId);
    if (selected) mapRef.current?.animateCamera({ center: { latitude: selected.latitude, longitude: selected.longitude } }, { duration: 260 });
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
      showsCompass={false}
      showsMyLocationButton={false}
      style={styles.map}>
      {markers.map((job) => {
        const selected = job.id === selectedJobId;
        const accent = job.category === 'technology' ? Palette.blue : job.category === 'business' ? Palette.coral : Palette.lime;
        const iconName = job.category === 'technology'
          ? { ios: 'chevron.left.forwardslash.chevron.right' as const, android: 'code' as const, web: 'code' as const }
          : job.category === 'business'
            ? { ios: 'briefcase.fill' as const, android: 'work' as const, web: 'work' as const }
            : { ios: 'wrench.and.screwdriver.fill' as const, android: 'construction' as const, web: 'construction' as const };
        return (
          <Marker
            key={job.id}
            accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`}
            accessibilityState={{ selected }}
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: job.latitude, longitude: job.longitude }}
            onPress={() => onSelect(job)}>
            <View style={[styles.markerOuter, selected && styles.markerOuterSelected, Shadows.subtle]}>
              <View style={[styles.markerInner, { backgroundColor: accent }]}>
                <AppIcon name={iconName} size={selected ? 20 : 17} tintColor={Palette.white} />
              </View>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  emptyText: { color: Palette.textSecondary, textAlign: 'center', padding: 24 },
  markerOuter: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, borderWidth: 3, borderColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  markerOuterSelected: { width: 54, height: 54, borderRadius: 27, borderColor: Palette.blueDark },
  markerInner: { width: '100%', height: '100%', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
