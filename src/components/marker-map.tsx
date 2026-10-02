import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as maplibregl from 'maplibre-gl';

import type { KmPosRecord } from '@/services/api';

const MAP_CENTER = {
  latitude: 3.139,
  longitude: 101.6869,
};

type MarkerMapProps = {
  loading: boolean;
  records: KmPosRecord[];
  onSelect: (record: KmPosRecord) => void;
};

export function MarkerMap({ loading, records, onSelect }: MarkerMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || loading || !containerRef.current) return;

    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.tuxgeo.dev/styles/osm-bright.json',
      center: [MAP_CENTER.longitude, MAP_CENTER.latitude],
      zoom: 8,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    if (Platform.OS !== 'web' || loading) return;
    const map = mapRef.current;
    if (!map) return;

    for (const marker of Array.from(
      containerRef.current?.querySelectorAll('.kmpos-marker') ?? [],
    )) {
      marker.remove();
    }

    for (const record of records.filter(
      (item) =>
        typeof item.latitude === 'number' && typeof item.longitude === 'number',
    )) {
      const element = document.createElement('button');
      element.className = 'kmpos-marker';
      element.type = 'button';
      element.title = `KM marker ${record.fid}`;
      Object.assign(element.style, {
        backgroundColor: '#0284c7',
        border: '2px solid white',
        borderRadius: '999px',
        boxShadow: '0 1px 4px rgba(15, 23, 42, .35)',
        cursor: 'pointer',
        height: '14px',
        padding: '0',
        width: '14px',
      });
      element.addEventListener('click', () => onSelect(record));
      new maplibregl.Marker({ element })
        .setLngLat([record.longitude as number, record.latitude as number])
        .addTo(map);
    }
  }, [loading, onSelect, records]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0284c7" size="large" />
        <Text style={styles.text}>Loading KM markers...</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        ref={(node) => {
          containerRef.current = node as unknown as HTMLElement;
        }}
        style={styles.map}
      />
    );
  }

  // react-native-maps is loaded only on iOS/Android; it has no web implementation.
  const { default: MapView, Marker } =
    require('react-native-maps') as typeof import('react-native-maps');

  return (
    <MapView
      initialRegion={{
        latitude: MAP_CENTER.latitude,
        longitude: MAP_CENTER.longitude,
        latitudeDelta: 7,
        longitudeDelta: 7,
      }}
      style={styles.map}>
      {records
        .filter(
          (record) =>
            typeof record.latitude === 'number' && typeof record.longitude === 'number',
        )
        .map((record) => (
          <Marker
            key={record.fid}
            coordinate={{
              latitude: record.latitude as number,
              longitude: record.longitude as number,
            }}
            title={`KM marker ${record.fid}`}
            description={`${record.state ?? 'Unknown state'} · Route ${record.route_no ?? '-'}`}
            onPress={() => onSelect(record)}
          />
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  map: { flex: 1, minHeight: 300 },
  text: { color: '#64748b', marginTop: 8 },
});
