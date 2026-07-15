import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { buildJobShareCopy, type ShareableJob } from '@/lib/job-sharing';
import type { Locale } from '@/lib/i18n';

type JobShareCardProps = {
  job: ShareableJob;
  locale: Locale;
  width: number;
  height: number;
};

export const JobShareCard = forwardRef<View, JobShareCardProps>(function JobShareCard({ height, job, locale, width }, ref) {
  const copy = buildJobShareCopy({ job, locale });
  if (!copy) return null;

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width, height }]}>
      <View style={styles.topGlow} />
      <View style={styles.brandRow}>
        <View style={styles.mark}><View style={styles.markInner} /></View>
        <Text style={styles.brand}>APPRENTICE{`\n`}ATLAS</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>{locale === 'de' ? 'GETEILTE CHANCE' : 'SHARED OPPORTUNITY'}</Text>
        <Text numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.title}>{copy.title}</Text>
        <Text numberOfLines={2} style={styles.company}>{job.company.trim()}</Text>

        <View style={styles.locationBlock}>
          <View style={styles.locationDot} />
          <Text numberOfLines={2} style={styles.location}>{copy.location}</Text>
        </View>
      </View>

      <View style={styles.sourcePanel}>
        <Text style={styles.sourceLabel}>{locale === 'de' ? 'ORIGINALQUELLE' : 'ORIGINAL SOURCE'}</Text>
        <Text numberOfLines={2} style={styles.sourceName}>{job.sourceName.trim()}</Text>
      </View>

      <View style={styles.linkPanel}>
        <Text style={styles.linkLabel}>{locale === 'de' ? 'IN APPRENTICE ATLAS ÖFFNEN' : 'OPEN IN APPRENTICE ATLAS'}</Text>
        <Text numberOfLines={2} style={styles.link}>{copy.deepLink}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: Palette.blue, paddingHorizontal: 32, paddingTop: 34, paddingBottom: 30 },
  topGlow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, right: -150, top: -120, backgroundColor: '#4E86F7', opacity: 0.58 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  markInner: { width: 14, height: 22, borderRadius: 7, backgroundColor: Palette.blue, transform: [{ rotate: '38deg' }] },
  brand: { color: Palette.white, fontSize: 13, lineHeight: 14, fontWeight: '900', letterSpacing: 1.3 },
  content: { flex: 1, justifyContent: 'center', paddingVertical: 34 },
  eyebrow: { color: '#DCE8FF', fontSize: 13, fontWeight: '800', letterSpacing: 1.6, marginBottom: 18 },
  title: { color: Palette.white, fontSize: 42, lineHeight: 47, fontWeight: '900', letterSpacing: -1.15 },
  company: { color: Palette.white, fontSize: 23, lineHeight: 29, fontWeight: '700', marginTop: 18 },
  locationBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  locationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#BBD1FF' },
  location: { flex: 1, color: '#EAF1FF', fontSize: 18, lineHeight: 24, fontWeight: '600' },
  sourcePanel: { gap: 5, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 18, backgroundColor: Palette.white, marginBottom: 13 },
  sourceLabel: { color: Palette.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sourceName: { color: Palette.text, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  linkPanel: { gap: 5, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', backgroundColor: 'rgba(8,31,77,0.34)' },
  linkLabel: { color: '#DCE8FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  link: { color: Palette.white, fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
