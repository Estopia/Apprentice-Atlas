import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Palette } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { getLegalDocument, isLegalDocumentId } from '@/lib/legal';

export default function LegalDocumentScreen() {
  const { document: documentParam } = useLocalSearchParams<{ document?: string | string[] }>();
  const [locale] = useLocale();
  const documentId = isLegalDocumentId(documentParam) ? documentParam : 'privacy';
  const document = getLegalDocument(locale, documentId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: document.title }} />
      <Text selectable style={styles.title}>{document.title}</Text>
      {document.updated && <Text style={styles.updated}>{t(locale, 'legal.lastUpdated')}: {document.updated}</Text>}
      <Text selectable style={styles.intro}>{document.intro}</Text>

      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text selectable style={styles.heading}>{section.heading}</Text>
          {section.paragraphs.map((paragraph) => <Text selectable key={paragraph} style={styles.paragraph}>{paragraph}</Text>)}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text selectable style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}

      {document.externalUrl && (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(document.externalUrl!)}
          style={({ pressed }) => [styles.externalLink, pressed && styles.pressed]}
        >
          <Text style={styles.externalLinkText}>{t(locale, 'legal.externalPolicy')}</Text>
          <AppIcon name={{ ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' }} size={16} tintColor={Palette.blue} />
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 64, gap: 22 },
  title: { color: Palette.text, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7 },
  updated: { marginTop: -14, color: Palette.textSecondary, fontSize: 13 },
  intro: { color: Palette.text, fontSize: 17, lineHeight: 25, fontWeight: '600' },
  section: { gap: 9 },
  heading: { color: Palette.text, fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.2 },
  paragraph: { color: Palette.text, fontSize: 16, lineHeight: 24 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingRight: 4 },
  bullet: { color: Palette.blue, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  bulletText: { flex: 1, color: Palette.text, fontSize: 16, lineHeight: 24 },
  externalLink: { minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  externalLinkText: { color: Palette.blue, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
