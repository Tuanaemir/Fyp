import { memo, useEffect, useMemo, useRef, useState } from 'react';
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

const NATIVE_MARKER_GRID_SIZE = 0.025;
const MAX_NATIVE_MARKERS = 900;

export const MarkerMap = memo(function MarkerMap({
  loading,
  records,
  onSelect,
}: MarkerMapProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const recordsRef = useRef(records);
  const [mapReady, setMapReady] = useState(false);
  recordsRef.current = records;
  const nativeRecords = useMemo(() => {
    const visible = new Map<string, KmPosRecord>();

    for (const record of records) {
      if (typeof record.latitude !== 'number' || typeof record.longitude !== 'number') {
        continue;
      }
      const gridKey = `${Math.floor(record.latitude / NATIVE_MARKER_GRID_SIZE)}:${Math.floor(
        record.longitude / NATIVE_MARKER_GRID_SIZE,
      )}`;
      if (!visible.has(gridKey)) visible.set(gridKey, record);
      if (visible.size >= MAX_NATIVE_MARKERS) break;
    }

    return Array.from(visible.values());
  }, [records]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.tuxgeo.dev/styles/osm-bright.json',
      center: [MAP_CENTER.longitude, MAP_CENTER.latitude],
      zoom: 8,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.once('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || loading || !mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const features = records
      .filter(
        (record) =>
          typeof record.latitude === 'number' && typeof record.longitude === 'number',
      )
      .map((record) => ({
        type: 'Feature' as const,
        properties: { fid: String(record.fid) },
        geometry: {
          type: 'Point' as const,
          coordinates: [record.longitude as number, record.latitude as number] as [
            number,
            number,
          ],
        },
      }));
    const sourceData = {
      type: 'FeatureCollection' as const,
      features,
    };

    const updateSource = () => {
      const source = map.getSource('km-posts') as maplibregl.GeoJSONSource | undefined;
      source?.setData(sourceData);
    };

    if (!map.getSource('km-posts')) {
      map.addSource('km-posts', {
        type: 'geojson',
        data: sourceData,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 45,
      });
      map.addLayer({
        id: 'km-post-clusters',
        type: 'circle',
        source: 'km-posts',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1d4ed8',
          'circle-radius': ['step', ['get', 'point_count'], 18, 25, 23, 100, 28],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'km-post-cluster-count',
        type: 'symbol',
        source: 'km-posts',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: { 'text-color': '#fff' },
      });
      map.addLayer({
        id: 'km-post-points',
        type: 'circle',
        source: 'km-posts',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#2563eb',
          'circle-radius': 6,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      map.on('click', 'km-post-clusters', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource('km-posts') as maplibregl.GeoJSONSource;
        void source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          map.easeTo({ center: coordinates, zoom });
        });
      });

      map.on('click', 'km-post-points', (event) => {
        const fid = event.features?.[0]?.properties?.fid;
        const selected = recordsRef.current.find(
          (record) => String(record.fid) === String(fid),
        );
        if (selected) onSelect(selected);
      });
      map.on('mouseenter', 'km-post-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'km-post-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'km-post-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'km-post-points', () => {
        map.getCanvas().style.cursor = '';
      });
    } else {
      updateSource();
    }
  }, [loading, mapReady, onSelect, records]);

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
      {nativeRecords.map((record) => (
          <Marker
            key={record.fid}
            coordinate={{
              latitude: record.latitude as number,
              longitude: record.longitude as number,
            }}
            title={`KM marker ${record.fid}`}
            description={`${record.state ?? 'Unknown state'} · Route ${record.route_no ?? '-'}`}
            onPress={() => onSelect(record)}
            tracksViewChanges={false}
          >
            {/* Custom dot — matches the web map style, no native red pin or glow */}
            <View style={styles.dot} />
          </Marker>
        ))}
    </MapView>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  map: { flex: 1, minHeight: 300 },
  text: { color: '#64748b', marginTop: 8 },
  dot: {
    backgroundColor: '#0284c7',
    borderColor: '#fff',
    borderRadius: 999,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
});
