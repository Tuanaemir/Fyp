import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkerMap } from '@/components/marker-map';
import { fetchKmPosRecords, type KmPosRecord } from '@/services/api';

export default function MobileDashboard() {
  const [records, setRecords] = useState<KmPosRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<KmPosRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async (searchValue = '') => {
    try {
      setLoading(true);
      setError('');
      setRecords(await fetchKmPosRecords(searchValue));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(() => loadRecords());
    }, [loadRecords]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>KM</Text>
          </View>
          <View>
            <Text style={styles.brand}>KMPOS</Text>
            <Text style={styles.brandSubtitle}>Malaysia field mapping</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
          <Text style={styles.profileText}>NI</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Find a marker</Text>
        <Text style={styles.pageDescription}>Search the map or add a new KM marker.</Text>

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void loadRecords(search)}
            placeholder="Route, state, district or ID"
            placeholderTextColor="#64748b"
            returnKeyType="search"
            style={styles.searchInput}
          />
          <Pressable onPress={() => void loadRecords(search)} style={styles.searchButton}>
            <Text style={styles.searchButtonText}>Go</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/capture')} style={styles.primaryAction}>
            <Text style={styles.actionText}>＋ Add marker</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/records')} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Browse records</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.mapCard}>
          <MarkerMap loading={loading} records={records} onSelect={setSelectedRecord} />
        </View>

        {selectedRecord ? (
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeading}>
              <Text style={styles.selectedTitle}>KM Marker {selectedRecord.fid}</Text>
              <Pressable onPress={() => setSelectedRecord(null)}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.selectedMeta}>
              Route {selectedRecord.route_no ?? '-'} · {selectedRecord.state ?? 'Unknown state'}
            </Text>
            <Text style={styles.selectedMeta}>
              {selectedRecord.latitude}, {selectedRecord.longitude}
            </Text>
            {selectedRecord.Google_StreetView || selectedRecord['Google StreetView'] ? (
              <Pressable
                onPress={() =>
                  void Linking.openURL(
                    selectedRecord.Google_StreetView ??
                      selectedRecord['Google StreetView'] ??
                      '',
                  )
                }
                style={styles.streetViewButton}>
                <Text style={styles.streetViewText}>Open Street View</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push(`/capture?fid=${selectedRecord.fid}`)}
              style={styles.editButton}>
              <Text style={styles.editButtonText}>Capture / update this marker</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Recent markers</Text>
        {records.slice(0, 5).map((record) => (
          <Pressable
            key={`recent-${record.fid}`}
            onPress={() => setSelectedRecord(record)}
            style={styles.recordRow}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{record.route_no ?? '-'}</Text>
            </View>
            <View style={styles.recordInfo}>
              <Text style={styles.recordTitle}>KM marker {record.fid}</Text>
              <Text style={styles.recordSubtitle}>
                {record.district ?? 'No district'} · {record.state ?? 'No state'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    alignItems: 'center',
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  brandRow: { alignItems: 'center', flexDirection: 'row' },
  logo: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    height: 38,
    justifyContent: 'center',
    marginRight: 10,
    width: 48,
  },
  logoText: { color: '#0284c7', fontSize: 15, fontWeight: '800' },
  brand: { color: '#fff', fontSize: 16, fontWeight: '700' },
  brandSubtitle: { color: '#e0f2fe', fontSize: 11 },
  profileButton: {
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 20,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  profileText: { color: '#0369a1', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  pageTitle: { color: '#0f172a', fontSize: 23, fontWeight: '800' },
  pageDescription: { color: '#64748b', fontSize: 14, marginTop: 4 },
  searchRow: { flexDirection: 'row', marginTop: 16 },
  searchInput: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchButton: {
    backgroundColor: '#0369a1',
    borderRadius: 8,
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 14,
  },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryAction: { backgroundColor: '#0284c7', borderRadius: 8, flex: 1, padding: 12 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryAction: {
    borderColor: '#94a3b8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  secondaryActionText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 10 },
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 300,
    marginTop: 16,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  loadingText: { color: '#64748b', marginTop: 10 },
  selectedCard: {
    backgroundColor: '#fff',
    borderColor: '#bae6fd',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  selectedHeading: { flexDirection: 'row', justifyContent: 'space-between' },
  selectedTitle: { color: '#0f172a', fontSize: 17, fontWeight: '700' },
  close: { color: '#0369a1', fontWeight: '600' },
  selectedMeta: { color: '#64748b', marginTop: 5 },
  editButton: { alignSelf: 'flex-start', backgroundColor: '#e0f2fe', borderRadius: 7, marginTop: 12, padding: 10 },
  editButtonText: { color: '#0369a1', fontWeight: '700' },
  streetViewButton: {
    alignSelf: 'flex-start',
    borderColor: '#16a34a',
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  streetViewText: { color: '#15803d', fontWeight: '700' },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  recordRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 8,
    padding: 12,
  },
  routeBadge: { alignItems: 'center', backgroundColor: '#166534', borderRadius: 7, padding: 10 },
  routeBadgeText: { color: '#fff', fontWeight: '800' },
  recordInfo: { flex: 1, marginLeft: 12 },
  recordTitle: { color: '#0f172a', fontWeight: '700' },
  recordSubtitle: { color: '#64748b', fontSize: 13, marginTop: 3 },
  chevron: { color: '#94a3b8', fontSize: 26 },
});
