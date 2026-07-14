import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import { hasMapPosition } from '@/lib/jobs';
import type { Job } from '@/types/jobs';

export type JobMapProps = { jobs: Job[]; selectedJobId?: string; onSelect: (job: Job) => void };
type MappedJob = Job & { latitude: number; longitude: number };

export default function JobMap({ jobs, selectedJobId, onSelect }: JobMapProps) {
  const markers = jobs.filter(hasMapPosition) as MappedJob[];
  const initial = markers[0];
  if (!initial) return <View style={styles.empty}><Text>No map locations available.</Text></View>;
  return (
    <MapView style={styles.map} initialRegion={{ latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 8, longitudeDelta: 8 }}>
      {markers.map((job) => <Marker key={job.id} coordinate={{ latitude: job.latitude, longitude: job.longitude }} title={job.title} description={job.company} pinColor={job.id === selectedJobId ? '#d95d39' : undefined} onPress={() => onSelect(job)} />)}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1, minHeight: 260, borderRadius: 20 }, empty: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center' } });
