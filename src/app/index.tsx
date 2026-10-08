import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkerMap } from '@/components/marker-map';
import { checkApiHealth, fetchKmPosRecords, type KmPosRecord } from '@/services/api';

export default function MobileDashboard() {
  const [records, setRecords] = useState<KmPosRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<KmPosRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [connection, setConnection] = useState<'checking' | 'connected' | 'offline'>('checking');

  const loadRecords = useCallback(async (searchValue = '') => {
    try {
      setLoading(true);
      setError('');
      setRecords(await fetchKmPosRecords(searchValue));
      setConnection('connected');
    } catch (loadError) {
      setConnection('offline');
      setError(loadError instanceof Error ? loadError.message : 'Unable to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      await checkApiHealth();
      setConnection('connected');
    } catch {
      setConnection('offline');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(() => loadRecords());
      void checkConnection();
    }, [checkConnection, loadRecords]),
  );

  const filters = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          records
            .map((record) => record.highway)
            .filter((highway): highway is string => Boolean(highway)),
        ),
      ).slice(0, 4),
    ],
    [records],
  );

  const visibleRecords = useMemo(() => {
    if (activeFilter === 'All') return records;
    return records.filter((record) => record.highway === activeFilter);
  }, [activeFilter, records]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapLayer}>
        <MarkerMap
          loading={loading}
          records={visibleRecords}
          onSelect={setSelectedRecord}
        />
      </View>

      <View style={styles.topOverlay}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void loadRecords(search)}
            placeholder="Search KM post, route or state"
            placeholderTextColor="#64748b"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
            <Text style={styles.profileText}>NI</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {filters.map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[styles.filterChip, activeFilter === filter && styles.activeFilterChip]}>
              <Text
                numberOfLines={1}
                style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>
                {filter}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.mapActions}>
        <Pressable
          onPress={() => void loadRecords(search)}
          style={styles.roundAction}
          accessibilityLabel="Refresh map">
          <Text style={styles.roundActionText}>↻</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/records')}
          style={styles.roundAction}
          accessibilityLabel="Browse all KM posts">
          <Text style={styles.roundActionText}>☷</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.connectionBadge}>
        <View
          style={[
            styles.connectionDot,
            connection === 'connected' && styles.connectedDot,
            connection === 'offline' && styles.offlineDot,
          ]}
        />
        <Text style={styles.connectionText}>
          {connection === 'connected'
            ? 'Database connected'
            : connection === 'offline'
              ? 'Offline'
              : 'Checking connection'}
        </Text>
      </View>

      {selectedRecord ? (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.selectedHeading}>
            <View style={styles.markerTitleRow}>
              <View style={styles.markerIcon}>
                <Text style={styles.markerIconText}>KM</Text>
              </View>
              <View style={styles.markerTitleInfo}>
                <Text style={styles.selectedTitle}>KM Post {selectedRecord.fid}</Text>
                <Text style={styles.selectedMeta} numberOfLines={1}>
                  {selectedRecord.highway ?? 'Road network'} · Route {selectedRecord.route_no ?? '-'}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setSelectedRecord(null)} hitSlop={10}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <View style={styles.sheetDetails}>
            <Text style={styles.detailText}>
              {selectedRecord.state ?? 'Unknown state'} · {selectedRecord.district ?? 'No district'}
            </Text>
            <Text style={styles.detailText}>
              {selectedRecord.latitude ?? '-'}, {selectedRecord.longitude ?? '-'}
            </Text>
          </View>
          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => router.push(`/capture?fid=${selectedRecord.fid}`)}
              style={styles.sheetPrimaryAction}>
              <Text style={styles.sheetPrimaryText}>Update KM post</Text>
            </Pressable>
            {selectedRecord.Google_StreetView || selectedRecord['Google StreetView'] ? (
              <Pressable
                onPress={() =>
                  void Linking.openURL(
                    selectedRecord.Google_StreetView ??
                      selectedRecord['Google StreetView'] ??
                      '',
                  )
                }
                style={styles.sheetSecondaryAction}>
                <Text style={styles.sheetSecondaryText}>Street View</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.mapLegend}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>
            {visibleRecords.length.toLocaleString()} KM posts on map
          </Text>
        </View>
      )}

      <Pressable onPress={() => router.push('/capture')} style={styles.addButton}>
        <Text style={styles.addButtonText}>＋</Text>
        <Text style={styles.addButtonLabel}>Add KM post</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#e2e8f0', flex: 1 },
  mapLayer: StyleSheet.absoluteFill,
  topOverlay: { left: 14, position: 'absolute', right: 14, top: 10 },
  searchBar: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    elevation: 5,
    flexDirection: 'row',
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 8,
    shadowColor: '#0f172a',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  searchIcon: { color: '#475569', fontSize: 29, lineHeight: 30, marginRight: 9 },
  profileButton: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 20,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  profileText: { color: '#1d4ed8', fontWeight: '800' },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  clearSearch: { color: '#64748b', fontSize: 26, marginHorizontal: 10 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterChip: {
    backgroundColor: '#fff',
    borderRadius: 18,
    elevation: 3,
    maxWidth: 150,
    paddingHorizontal: 15,
    paddingVertical: 9,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  activeFilterChip: { backgroundColor: '#1d4ed8' },
  filterText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  activeFilterText: { color: '#fff' },
  mapActions: {
    gap: 10,
    position: 'absolute',
    right: 14,
    top: 138,
  },
  roundAction: {
    backgroundColor: '#fff',
    borderRadius: 22,
    elevation: 4,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    width: 44,
  },
  roundActionText: { color: '#1e3a8a', fontSize: 24, textAlign: 'center' },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    left: 14,
    padding: 10,
    position: 'absolute',
    right: 14,
    top: 200,
  },
  error: { color: '#b91c1c', fontSize: 12 },
  connectionBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    top: 200,
  },
  connectionDot: { backgroundColor: '#f59e0b', borderRadius: 4, height: 8, marginRight: 6, width: 8 },
  connectedDot: { backgroundColor: '#16a34a' },
  offlineDot: { backgroundColor: '#dc2626' },
  connectionText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    bottom: 0,
    elevation: 10,
    left: 0,
    padding: 16,
    paddingBottom: 24,
    position: 'absolute',
    right: 0,
    shadowColor: '#0f172a',
    shadowOffset: { height: -2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    height: 5,
    marginBottom: 13,
    width: 42,
  },
  selectedHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  markerTitleRow: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  markerIcon: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  markerIconText: { color: '#1d4ed8', fontSize: 11, fontWeight: '900' },
  markerTitleInfo: { flex: 1, marginLeft: 11 },
  selectedTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  selectedMeta: { color: '#64748b', marginTop: 4 },
  close: { color: '#475569', fontSize: 28, paddingLeft: 12 },
  sheetDetails: { flexDirection: 'row', gap: 18, marginLeft: 55, marginTop: 8 },
  detailText: { color: '#64748b', fontSize: 12 },
  sheetActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  sheetPrimaryAction: { backgroundColor: '#1d4ed8', borderRadius: 8, flex: 1, padding: 12 },
  sheetPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  sheetSecondaryAction: { borderColor: '#93c5fd', borderRadius: 8, borderWidth: 1, padding: 12 },
  sheetSecondaryText: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  mapLegend: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    bottom: 24,
    elevation: 4,
    flexDirection: 'row',
    left: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: 'absolute',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 4,
  },
  legendDot: { backgroundColor: '#2563eb', borderColor: '#fff', borderRadius: 6, borderWidth: 2, height: 12, marginRight: 7, width: 12 },
  legendText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 28,
    bottom: 18,
    elevation: 7,
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'absolute',
    right: 14,
    shadowColor: '#1e3a8a',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonText: { color: '#fff', fontSize: 25, lineHeight: 25 },
  addButtonLabel: { color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 6 },
});
