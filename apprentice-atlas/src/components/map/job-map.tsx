import { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { decideMapCameraSync, getJobAccessibilityLabel, type MapCameraSyncState } from '@/lib/discovery-presentation';
import { t, useLocale } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/jobs';
import { clusterJobsForRegion, type JobCluster, type PositionedJob } from '@/lib/map-clusters';
import { getJobsMapRegion, getRenderableMapRegion, hasMeaningfulRegionChange, type JobMapRegion } from '@/lib/map-region';
import type { Job } from '@/types/jobs';

export type JobMapProps = { jobs: Job[]; cameraIntent: string; resultsLoading: boolean; selectedJobId?: string; onSelect: (job: Job) => void; onRegionChange?: (region: JobMapRegion) => void };
export default function JobMap({ jobs, cameraIntent, resultsLoading, selectedJobId, onSelect, onRegionChange }: JobMapProps) {
  const [locale] = useLocale();
  const mapRef = useRef<MapView>(null);
  const ignoreNextRegionChange = useRef(true);
  const cameraSync = useRef<MapCameraSyncState>({ observedIntent: null, appliedIntent: null, pendingIntent: null, pendingResultIdentity: null, sawLoading: false });
  const markers = useMemo(() => jobs.filter(hasMapPosition) as PositionedJob[], [jobs]);
  const region = useMemo(() => getJobsMapRegion(jobs), [jobs]);
  const [visibleRegion, setVisibleRegion] = useState<JobMapRegion | null>(region);
  const renderRegion = getRenderableMapRegion(region, visibleRegion);
  const clusteredRegion = useRef<JobMapRegion | null>(region);
  const resultIdentity = useMemo(() => region ? [
    region.latitude.toFixed(5), region.longitude.toFixed(5), region.latitudeDelta.toFixed(5), region.longitudeDelta.toFixed(5),
    ...markers.map((job) => `${job.id}:${job.latitude.toFixed(5)},${job.longitude.toFixed(5)}`).sort(),
  ].join('|') : null, [markers, region]);
  const clusters = useMemo(() => visibleRegion ? clusterJobsForRegion(markers, visibleRegion) : [], [markers, visibleRegion]);
  const displayClusters = useMemo(() => {
    if (!visibleRegion || visibleRegion.latitudeDelta > 0.025) return clusters;
    return clusters.flatMap((cluster) => {
      if (cluster.jobs.length === 1) return cluster;
      return cluster.jobs.map((job, index) => {
        const angle = (Math.PI * 2 * index) / cluster.jobs.length;
        return {
          id: `${cluster.id}:${job.id}`,
          jobs: [job],
          latitude: cluster.latitude + Math.sin(angle) * visibleRegion.latitudeDelta * 0.025,
          longitude: cluster.longitude + Math.cos(angle) * visibleRegion.longitudeDelta * 0.025,
        };
      });
    });
  }, [clusters, visibleRegion]);

  useEffect(() => {
    const decision = decideMapCameraSync(cameraSync.current, { intent: cameraIntent, resultIdentity, loading: resultsLoading });
    cameraSync.current = decision.state;
    if (!decision.apply || !region) return;
    ignoreNextRegionChange.current = true;
    clusteredRegion.current = region;
    setVisibleRegion(region);
    mapRef.current?.animateToRegion(region, 350);
  }, [cameraIntent, region, resultIdentity, resultsLoading]);

  const selected = markers.find((job) => job.id === selectedJobId);
  const selectedCameraKey = selected ? `${selected.id}:${selected.latitude.toFixed(5)},${selected.longitude.toFixed(5)}` : null;
  const selectedLatitude = selected?.latitude;
  const selectedLongitude = selected?.longitude;
  useEffect(() => {
    if (selectedLatitude === undefined || selectedLongitude === undefined || !selectedCameraKey) return;
    ignoreNextRegionChange.current = true;
    mapRef.current?.animateCamera({ center: { latitude: selectedLatitude, longitude: selectedLongitude } }, { duration: 260 });
  }, [selectedCameraKey, selectedLatitude, selectedLongitude]);

  const selectCluster = (cluster: JobCluster) => {
    if (cluster.jobs.length === 1) {
      onSelect(cluster.jobs[0]);
      return;
    }
    const current = visibleRegion ?? region;
    if (!current) return;
    ignoreNextRegionChange.current = true;
    mapRef.current?.animateToRegion({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      latitudeDelta: Math.max(current.latitudeDelta * 0.42, 0.018),
      longitudeDelta: Math.max(current.longitudeDelta * 0.42, 0.018),
    }, 280);
  };

  if (!renderRegion) return <View style={styles.empty} accessibilityLabel={t(locale, 'map.noPositions')}><Text style={styles.emptyText}>{t(locale, 'map.noPositions')}</Text></View>;

  return (
    <MapView
      ref={mapRef}
      accessibilityLabel={t(locale, 'map.markerList')}
      initialRegion={renderRegion}
      mapType="standard"
      userInterfaceStyle="light"
      pitchEnabled={false}
      rotateEnabled={false}
      onRegionChangeComplete={(next) => {
        const shouldRefresh = !clusteredRegion.current || hasMeaningfulRegionChange(clusteredRegion.current, next);
        if (shouldRefresh) {
          clusteredRegion.current = next;
          setVisibleRegion(next);
        }
        if (ignoreNextRegionChange.current) {
          ignoreNextRegionChange.current = false;
          return;
        }
        if (shouldRefresh) onRegionChange?.(next);
      }}
      showsCompass={false}
      showsMyLocationButton={false}
      style={styles.map}>
      {displayClusters.map((cluster) => {
        const job = cluster.jobs[0];
        const selected = cluster.jobs.some((item) => item.id === selectedJobId);
        const grouped = cluster.jobs.length > 1;
        return (
          <Marker
            key={cluster.id}
            accessibilityLabel={grouped ? `${cluster.jobs.length} ${t(locale, 'discovery.jobs')}` : getJobAccessibilityLabel(locale, job)}
            accessibilityState={{ selected }}
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={() => selectCluster(cluster)}
            zIndex={selected ? 4 : grouped ? 2 : 1}>
            <View style={styles.markerHit}>
              <View style={[styles.marker, grouped && styles.cluster, selected && styles.markerSelected]}>
                {grouped ? <Text style={styles.clusterText}>{cluster.jobs.length > 99 ? '99+' : cluster.jobs.length}</Text> : <AppIcon name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }} size={16} tintColor={Palette.white} />}
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
  markerHit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 38, height: 38, borderRadius: 19, backgroundColor: Palette.blue, borderWidth: 3, borderColor: Palette.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(8, 31, 77, 0.24)' },
  cluster: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.blueDark },
  markerSelected: { width: 48, height: 48, borderRadius: 24, backgroundColor: Palette.blue, borderWidth: 4 },
  clusterText: { color: Palette.white, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
