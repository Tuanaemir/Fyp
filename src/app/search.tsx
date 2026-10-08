import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchKmPosRecords, type KmPosRecord } from '@/services/api';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KmPosRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      void fetchKmPosRecords(query)
        .then(setResults)
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : 'Unable to search KM posts');
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Search KM posts</Text>
      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        placeholder="Highway, route, KM, state or district"
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#0891b2" style={styles.loader} /> : null}
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.fid)}
        initialNumToRender={15}
        windowSize={5}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/capture?fid=${item.fid}`)} style={styles.card}>
            <View style={styles.badge}><Text style={styles.badgeText}>{item.route_no ?? '-'}</Text></View>
            <View style={styles.info}>
              <Text style={styles.cardTitle}>KM {item.dist_1 ?? '-'} · {item.highway ?? 'Unknown highway'}</Text>
              <Text style={styles.meta}>{item.state ?? '-'} · {item.district ?? '-'}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No KM posts found.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f8fafc', flex: 1, padding: 18 },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '800', marginBottom: 14 },
  input: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderRadius: 12, borderWidth: 1, padding: 14 },
  error: { color: '#b91c1c', marginTop: 10 },
  loader: { marginTop: 16 },
  list: { paddingVertical: 16 },
  card: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', marginBottom: 8, padding: 13 },
  badge: { alignItems: 'center', backgroundColor: '#0891b2', borderRadius: 8, padding: 10 },
  badgeText: { color: '#fff', fontWeight: '800' },
  info: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#0f172a', fontWeight: '800' },
  meta: { color: '#64748b', marginTop: 4 },
  empty: { color: '#64748b', paddingVertical: 32, textAlign: 'center' },
});
