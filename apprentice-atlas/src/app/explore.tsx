import { StyleSheet, Text, View } from 'react-native';
import { useLocale, t } from '@/lib/i18n';

export default function SavedScreen() {
  const [locale] = useLocale();
  return <View style={styles.container}><Text style={styles.title}>{t(locale, 'saved.title')}</Text><Text style={styles.copy}>{t(locale, 'saved.description')}</Text></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f7f5f0', justifyContent: 'center', alignItems: 'center', padding: 24 }, title: { fontSize: 26, fontWeight: '800', color: '#173b35' }, copy: { marginTop: 10, color: '#53645f', textAlign: 'center' } });
