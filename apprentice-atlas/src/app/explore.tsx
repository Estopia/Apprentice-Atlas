import { StyleSheet, Text, View } from 'react-native';

export default function SavedScreen() {
  return <View style={styles.container}><Text style={styles.title}>Saved opportunities</Text><Text style={styles.copy}>Sign in to keep apprenticeships here for later.</Text></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f7f5f0', justifyContent: 'center', alignItems: 'center', padding: 24 }, title: { fontSize: 26, fontWeight: '800', color: '#173b35' }, copy: { marginTop: 10, color: '#53645f', textAlign: 'center' } });
