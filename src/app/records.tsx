import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchKmPosRecords, type KmPosRecord } from '@/services/api';

export default function RecordsScreen() {
  const [records, setRecords] = useState<KmPosRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadRecords(searchValue = '') {
    try {
      setLoading(true);
      setError('');
      setRecords(await fetchKmPosRecords(searchValue));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load records');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadRecords());
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Map Records</Text>
        <Text style={styles.subtitle}>Tap a marker to edit it.</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void loadRecords(search)}
          placeholder="Route, state, district or fid"
          style={styles.input}
        />
        <Pressable onPress={() => void loadRecords(search)} style={styles.searchButton}>
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color="#0284c7" size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(record) => String(record.fid)}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {records.length} {records.length === 1 ? 'marker' : 'markers'}
            </Text>
          }
          renderItem={({ item: record }) => (
            <Pressable
              onPress={() => router.push(`/capture?fid=${record.fid}`)}
              style={styles.record}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeText}>{record.route_no ?? '-'}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.recordTitle}>KM marker {record.fid}</Text>
                <Text style={styles.recordSubtitle}>
                  {record.district ?? 'No district'} · {record.state ?? 'No state'}
                </Text>
                <Text style={styles.coordinates}>
                  {record.latitude ?? '-'}, {record.longitude ?? '-'}
                </Text>
                {record.photo_url ? (
                  <Text style={styles.photoStatus}>Signboard photo saved</Text>
                ) : null}
                {(record.Google_StreetView || record['Google StreetView']) ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      void Linking.openURL(
                        record.Google_StreetView ?? record['Google StreetView'] ?? '',
                      );
                    }}>
                    <Text style={styles.streetView}>Open Street View</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No markers found. Try another search.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 18 },
  header: { marginBottom: 18 },
  backButton: { alignSelf: 'flex-start', marginBottom: 18 },
  backText: { color: '#0369a1', fontSize: 16, fontWeight: '600' },
  title: { color: '#0f172a', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 15, marginTop: 5 },
  searchRow: { flexDirection: 'row' },
  input: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  searchButton: { backgroundColor: '#0369a1', borderRadius: 8, justifyContent: 'center', marginLeft: 8, paddingHorizontal: 14 },
  searchText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 12 },
  loader: { marginTop: 40 },
  list: { paddingVertical: 16 },
  resultCount: { color: '#64748b', fontSize: 13, marginBottom: 10 },
  empty: { color: '#64748b', paddingVertical: 32, textAlign: 'center' },
  record: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, flexDirection: 'row', marginBottom: 8, padding: 12 },
  routeBadge: { alignItems: 'center', backgroundColor: '#166534', borderRadius: 7, padding: 10 },
  routeText: { color: '#fff', fontWeight: '800' },
  info: { flex: 1, marginLeft: 12 },
  recordTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700' },
  recordSubtitle: { color: '#475569', marginTop: 3 },
  coordinates: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  streetView: { color: '#15803d', fontSize: 12, fontWeight: '700', marginTop: 6 },
  photoStatus: { color: '#64748b', fontSize: 12, marginTop: 5 },
  chevron: { color: '#94a3b8', fontSize: 26 },
});
