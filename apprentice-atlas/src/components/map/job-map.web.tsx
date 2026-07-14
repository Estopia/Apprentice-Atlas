import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Palette, Shadows } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/jobs';
import type { Job } from '@/types/jobs';
import type { JobMapProps } from './job-map';

const markerPositions = [
  { left: '18%', top: '31%' }, { left: '43%', top: '24%' }, { left: '68%', top: '37%' },
  { left: '31%', top: '53%' }, { left: '57%', top: '58%' }, { left: '78%', top: '65%' },
  { left: '12%', top: '70%' }, { left: '48%', top: '76%' }, { left: '83%', top: '25%' },
] as const;

export default function JobMap({ jobs, selectedJobId, onSelect }: JobMapProps) {
  const [locale] = useLocale();
  const markers = jobs.filter(hasMapPosition);
  return (
    <View style={styles.surface} accessibilityLabel={t(locale, 'map.markerList')}>
      <View style={[styles.park, styles.parkOne]} /><View style={[styles.park, styles.parkTwo]} />
      <View style={styles.river} />
      <View style={[styles.road, styles.roadOne]} /><View style={[styles.road, styles.roadTwo]} /><View style={[styles.road, styles.roadThree]} /><View style={[styles.road, styles.roadFour]} /><View style={[styles.road, styles.roadFive]} />
      <Text style={[styles.cityLabel, styles.cityOne]}>BERLIN</Text><Text style={[styles.cityLabel, styles.cityTwo]}>LONDON</Text>
      {markers.slice(0, markerPositions.length).map((job, index) => (
        <WebMarker key={job.id} job={job} position={markerPositions[index]} selected={job.id === selectedJobId} onPress={() => onSelect(job)} />
      ))}
      {!markers.length && <View style={styles.empty}><Text style={styles.emptyText}>{t(locale, 'map.noPositions')}</Text></View>}
    </View>
  );
}

function WebMarker({ job, position, selected, onPress }: { job: Job; position: { left: string; top: string }; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`} accessibilityState={{ selected: selected }} onPress={onPress} style={[styles.marker, position as ViewStyle, selected && styles.markerSelected, Shadows.floating]}>
      <View style={[styles.markerInner, { backgroundColor: selected ? Palette.blueDark : Palette.blue }]}><View style={styles.markerDot} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1, width: '100%', minHeight: 560, overflow: 'hidden', position: 'relative', backgroundColor: '#E9F1F3' },
  river: { position: 'absolute', width: '150%', height: 105, left: '-18%', top: '45%', backgroundColor: '#B9DCF0', transform: [{ rotate: '-13deg' }] },
  park: { position: 'absolute', backgroundColor: '#DDEEC8', borderRadius: 42, transform: [{ rotate: '-8deg' }] },
  parkOne: { width: 310, height: 180, top: '10%', left: '8%' },
  parkTwo: { width: 420, height: 210, bottom: '8%', right: '5%' },
  road: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#D5DDE2' },
  roadOne: { width: '130%', height: 18, left: '-15%', top: '23%', transform: [{ rotate: '8deg' }] },
  roadTwo: { width: '120%', height: 15, left: '-10%', top: '70%', transform: [{ rotate: '-7deg' }] },
  roadThree: { width: 16, height: '120%', left: '35%', top: '-10%', transform: [{ rotate: '10deg' }] },
  roadFour: { width: 14, height: '120%', left: '68%', top: '-10%', transform: [{ rotate: '-12deg' }] },
  roadFive: { width: '110%', height: 12, left: '-5%', top: '37%', transform: [{ rotate: '-4deg' }] },
  cityLabel: { position: 'absolute', color: 'rgba(8,31,77,0.22)', fontSize: 42, fontWeight: '900', letterSpacing: 8 },
  cityOne: { left: '18%', top: '40%' },
  cityTwo: { right: '9%', bottom: '18%' },
  marker: { position: 'absolute', width: 48, height: 48, minHeight: 44, minWidth: 44, marginLeft: -24, marginTop: -24, borderRadius: 24, backgroundColor: Palette.white, borderWidth: 3, borderColor: Palette.white, padding: 3, zIndex: 4 },
  markerSelected: { width: 58, height: 58, marginLeft: -29, marginTop: -29, borderRadius: 29, borderColor: Palette.blueDark, zIndex: 6 },
  markerInner: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.white },
  empty: { position: 'absolute', alignSelf: 'center', top: '46%', backgroundColor: Palette.white, borderRadius: 18, padding: 18 },
  emptyText: { color: Palette.textSecondary },
});
