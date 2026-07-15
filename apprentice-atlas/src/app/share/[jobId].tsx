import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { JobShareCard } from '@/components/jobs/job-share-card';
import { AppIcon } from '@/components/ui/app-icon';
import { Palette, Radius } from '@/constants/theme';
import { buildJobShareCopy, isShareableJobId, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '@/lib/job-sharing';
import { getJob } from '@/lib/jobs';
import { t, useLocale } from '@/lib/i18n';
import type { Job } from '@/types/jobs';

export default function JobSharePreviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const routeJobId = String(jobId ?? '');
  const [locale] = useLocale();
  const { width: screenWidth } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const validJobId = isShareableJobId(routeJobId);
  const requestKey = `${routeJobId}:${locale}`;
  const [loadResult, setLoadResult] = useState<{ key: string; job: Job | null } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const currentResult = loadResult?.key === requestKey ? loadResult : null;
  const job = currentResult?.job ?? null;
  const loading = validJobId && !currentResult;
  const loadError = validJobId ? t(locale, 'share.loadError') : t(locale, 'share.invalidJob');
  const cardWidth = Math.min(Math.max(screenWidth - 32, 280), 420);
  const cardHeight = cardWidth * (SHARE_CARD_HEIGHT / SHARE_CARD_WIDTH);

  useEffect(() => {
    let active = true;
    if (!validJobId) return () => { active = false; };
    void getJob(routeJobId, undefined, locale).then((result) => {
      if (!active) return;
      setLoadResult({ key: requestKey, job: result.data });
    });
    return () => { active = false; };
  }, [locale, requestKey, routeJobId, validJobId]);

  const sharePlainText = async (currentJob: Job) => {
    const copy = buildJobShareCopy({ job: currentJob, locale });
    if (!copy) throw new Error('Invalid share payload.');
    await Share.share({ title: copy.title, message: copy.message });
  };

  const shareCard = async () => {
    if (!job || sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      if (Platform.OS !== 'web' && cardRef.current && await Sharing.isAvailableAsync()) {
        const uri = await captureRef(cardRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: SHARE_CARD_WIDTH,
          height: SHARE_CARD_HEIGHT,
        });
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: t(locale, 'share.systemTitle'),
        });
      } else {
        await sharePlainText(job);
      }
    } catch {
      try {
        await sharePlainText(job);
      } catch {
        setShareError(t(locale, 'share.error'));
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: t(locale, 'share.screenTitle') }} />
      {loading ? (
        <View style={styles.state}><ActivityIndicator accessibilityLabel={t(locale, 'share.loading')} color={Palette.blue} /><Text style={styles.stateText}>{t(locale, 'share.loading')}</Text></View>
      ) : job ? (
        <>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>{t(locale, 'share.previewTitle')}</Text>
            <Text style={styles.subtitle}>{t(locale, Platform.OS === 'web' ? 'share.webHint' : 'share.previewHint')}</Text>
          </View>
          <View style={styles.previewFrame}>
            <JobShareCard ref={cardRef} height={cardHeight} job={job} locale={locale} width={cardWidth} />
          </View>
          <Text style={styles.sourceNote}>{t(locale, 'share.sourceNote')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: sharing, disabled: sharing }}
            disabled={sharing}
            onPress={() => void shareCard()}
            style={({ pressed }) => [styles.shareButton, sharing && styles.disabled, pressed && styles.pressed]}
          >
            {sharing ? <ActivityIndicator color={Palette.white} /> : <AppIcon name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} size={20} tintColor={Palette.white} />}
            <Text style={styles.shareButtonText}>{t(locale, sharing ? 'share.sharing' : Platform.OS === 'web' ? 'share.shareText' : 'share.shareImage')}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.state}><AppIcon name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={26} tintColor={Palette.blue} /><Text accessibilityRole="alert" style={styles.stateText}>{loadError}</Text></View>
      )}
      {job && shareError && <Text accessibilityRole="alert" style={styles.error}>{shareError}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.surface },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', alignItems: 'center', padding: 16, paddingBottom: 64, gap: 18 },
  heading: { alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  title: { color: Palette.text, fontSize: 25, lineHeight: 31, fontWeight: '800', textAlign: 'center', letterSpacing: -0.35 },
  subtitle: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  previewFrame: { overflow: 'hidden', borderRadius: 24, backgroundColor: Palette.blue, boxShadow: '0 14px 40px rgba(8,31,77,0.22)' },
  sourceNote: { maxWidth: 520, color: Palette.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
  shareButton: { width: '100%', maxWidth: 420, minHeight: 54, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: Palette.blue },
  shareButtonText: { color: Palette.white, fontSize: 16, fontWeight: '800' },
  state: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { maxWidth: 520, color: Palette.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
