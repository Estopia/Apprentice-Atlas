import { Pressable, StyleSheet, Text, View } from 'react-native';

import { localizeCategory, useLocale, t } from '@/lib/i18n';
import { hasMapPosition } from '@/lib/job-filters';
import type { Job } from '@/types/jobs';

export function JobCard({ job, selected, onPress }: { job: Job; selected?: boolean; onPress: () => void }) {
  const [locale] = useLocale();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.company}, ${job.city}, ${job.country}`} accessibilityState={{ selected }} onPress={onPress} style={[styles.card, selected && styles.selected]}><View style={styles.row}><View style={styles.copy}><Text style={styles.title} numberOfLines={2}>{job.title}</Text><Text style={styles.company}>{job.company}</Text><Text style={styles.location}>{job.city}, {job.country}</Text></View><Text style={styles.category}>{localizeCategory(locale, job.category)}</Text></View><View style={styles.tags}>{job.tags.slice(0, 3).map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}{!hasMapPosition(job) && <Text style={styles.tag}>{t(locale, 'discovery.nationwide')}</Text>}</View></Pressable>;
}

const styles = StyleSheet.create({ card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e6e1da', minHeight: 44 }, selected: { borderColor: '#d95d39', backgroundColor: '#fff8f2' }, row: { flexDirection: 'row', gap: 12 }, copy: { flex: 1 }, title: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: '#173b35' }, company: { marginTop: 5, fontWeight: '600', color: '#53645f' }, location: { marginTop: 4, color: '#53645f' }, category: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#d95d39' }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, tag: { backgroundColor: '#edf1ee', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, color: '#36534b' } });
