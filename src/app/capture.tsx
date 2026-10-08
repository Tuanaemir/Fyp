
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addKmPost,
  fetchKmPosRecords,
  getPhotoUrl,
  deleteKmPost,
  updateKmPos,
  uploadKmPostPhoto,
} from '@/services/api';

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ fid?: string }>();
  const editing = Boolean(params.fid);
  const [fid] = useState(params.fid ?? '');
  const [routeNo, setRouteNo] = useState('');
  const [highway, setHighway] = useState('');
  const [kmDistance, setKmDistance] = useState('');
  const [destination, setDestination] = useState('');
  const [owner, setOwner] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [streetView, setStreetView] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Location.LocationObjectCoords | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.fid) return;
    void fetchKmPosRecords(params.fid).then((records) => {
      const record = records.find((item) => String(item.fid) === params.fid);
      if (!record) return;
      setRouteNo(record.route_no ?? '');
      setHighway(record.highway ?? '');
      setKmDistance(String(record.dist_1 ?? ''));
      setDestination(record.pri_desc1 ?? '');
      setOwner(record.pemilik ?? '');
      setType(record.type ?? '');
      setStatus(record.Status ?? '');
      setRemarks(record.Remarks ?? '');
      setState(record.state ?? '');
      setDistrict(record.district ?? '');
      setStreetView(record.Google_StreetView ?? record['Google StreetView'] ?? '');
      setSavedPhotoUrl(getPhotoUrl(record.photo_url));
      if (record.latitude != null && record.longitude != null) {
        setCoordinates({
          latitude: record.latitude,
          longitude: record.longitude,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          accuracy: null,
        });
      }
    }).catch(() => {
      Alert.alert('Unable to load marker', 'The existing marker could not be loaded.');
    });
  }, [params.fid]);

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to capture a field photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function captureLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location permission needed', 'Allow location access to capture your position.');
      return;
    }

    const result = await Location.getCurrentPositionAsync({});
    setCoordinates(result.coords);
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert('Delete KM post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteKmPost(Number(fid))
            .then(() => router.back())
            .catch((error: unknown) => {
              Alert.alert(
                'Unable to delete',
                error instanceof Error ? error.message : 'The server request failed.',
              );
            });
        },
      },
    ]);
  }

  async function saveRecord() {
    const recordId = Number(fid);
    if (editing && (!Number.isInteger(recordId) || recordId < 1)) {
      Alert.alert('Invalid record ID', 'Enter a positive integer fid.');
      return;
    }

    if (!routeNo.trim() || !coordinates) {
      Alert.alert('Add marker details', 'Enter a route number and select a location.');
      return;
    }
    if (coordinates.latitude < -90 || coordinates.latitude > 90 ||
      coordinates.longitude < -180 || coordinates.longitude > 180) {
      Alert.alert('Invalid coordinates', 'Latitude or longitude is outside the valid range.');
      return;
    }

    try {
      setSaving(true);
      const data = {
        highway: highway.trim() || undefined,
        route_no: routeNo.trim() || undefined,
        dist_1: kmDistance.trim() || undefined,
        pri_desc1: destination.trim() || undefined,
        state: state.trim() || undefined,
        district: district.trim() || undefined,
        pemilik: owner.trim() || undefined,
        type: type.trim() || undefined,
        Status: status.trim() || undefined,
        Google_StreetView: streetView.trim() || undefined,
        Remarks: remarks.trim() || undefined,
        ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
      };
      const savedRecord = editing
        ? await updateKmPos(recordId, data)
        : await addKmPost(data);
      const savedFid = savedRecord.fid;
      if (photoUri && savedFid != null) {
        try {
          const uploaded = await uploadKmPostPhoto(savedFid, photoUri);
          setSavedPhotoUrl(getPhotoUrl(uploaded.photo_url));
        } catch (uploadError) {
          throw new Error(
            `Marker saved, but the signboard photo could not be uploaded: ${
              uploadError instanceof Error ? uploadError.message : 'unknown upload error'
            }`,
          );
        }
      }
      Alert.alert('Success', editing ? 'Marker updated.' : 'New marker added.');
      router.back();
    } catch (error) {
      Alert.alert(
        'Unable to save',
        error instanceof Error ? error.message : 'The server request failed.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit marker' : 'Add marker'}</Text>
        <Text style={styles.subtitle}>
          {editing ? `Marker ${fid}` : 'Save the location and details in one step.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <Text style={styles.label}>Highway</Text>
        <TextInput value={highway} onChangeText={setHighway} placeholder="Highway name" style={styles.input} />
        <Text style={styles.label}>Route number</Text>
        <TextInput value={routeNo} onChangeText={setRouteNo} placeholder="Route number (example: 1)" style={styles.input} />
        <Text style={styles.label}>KM distance</Text>
        <TextInput value={kmDistance} onChangeText={setKmDistance} keyboardType="decimal-pad" placeholder="KM distance" style={styles.input} />
        <Text style={styles.label}>Destination</Text>
        <TextInput value={destination} onChangeText={setDestination} placeholder="Primary destination" style={styles.input} />
        <Text style={styles.label}>State</Text>
        <TextInput value={state} onChangeText={setState} placeholder="State" style={styles.input} />
        <Text style={styles.label}>District</Text>
        <TextInput value={district} onChangeText={setDistrict} placeholder="District" style={styles.input} />
        <Text style={styles.label}>Owner</Text>
        <TextInput value={owner} onChangeText={setOwner} placeholder="Owner" style={styles.input} />
        <Text style={styles.label}>Type</Text>
        <TextInput value={type} onChangeText={setType} placeholder="A, B, Highway or Federal" style={styles.input} />
        <Text style={styles.label}>Status</Text>
        <TextInput value={status} onChangeText={setStatus} placeholder="Status" style={styles.input} />
        <Text style={styles.label}>Street View link <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput value={streetView} onChangeText={setStreetView} placeholder="Street View URL (optional)" style={styles.input} />
        <Text style={styles.label}>Remarks</Text>
        <TextInput value={remarks} onChangeText={setRemarks} placeholder="Remarks" style={[styles.input, styles.multilineInput]} multiline />
        <Text style={styles.sectionLabel}>Field capture</Text>
        <Text style={styles.helperText}>
          Tap the map or drag the marker to choose the KM post location.
        </Text>
        {Platform.OS !== 'web' ? (() => {
          const { default: MapView, Marker } =
            require('react-native-maps') as typeof import('react-native-maps');
          const mapCoordinate = coordinates
            ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
            : { latitude: 3.139, longitude: 101.6869 };
          return (
            <MapView
              style={styles.placementMap}
              initialRegion={{ ...mapCoordinate, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
              onPress={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                setCoordinates({
                  latitude,
                  longitude,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                  accuracy: null,
                });
              }}>
              {coordinates ? (
                <Marker
                  coordinate={mapCoordinate}
                  draggable
                  onDragEnd={(event) => {
                    const { latitude, longitude } = event.nativeEvent.coordinate;
                    setCoordinates((current) => current ? { ...current, latitude, longitude } : current);
                  }}
                />
              ) : null}
            </MapView>
          );
        })() : null}
        {coordinates ? (
          <Text style={styles.coordinatesText}>
            {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
          </Text>
        ) : null}
        <View style={styles.captureRow}>
          <Pressable onPress={() => void captureLocation()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {coordinates ? 'Location captured' : 'Get GPS location'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void capturePhoto()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {photoUri ? 'Signboard captured' : 'Capture signboard'}
            </Text>
          </Pressable>
        </View>
        {photoUri || savedPhotoUrl ? (
          <Image
            accessibilityLabel="Captured signboard preview"
            source={{ uri: photoUri ?? savedPhotoUrl ?? undefined }}
            style={styles.photoPreview}
          />
        ) : null}
        {streetView ? (
          <Pressable onPress={() => void Linking.openURL(streetView)} style={styles.streetViewButton}>
            <Text style={styles.secondaryButtonText}>Open Street View</Text>
          </Pressable>
        ) : null}
        {editing ? (
          <Pressable onPress={confirmDelete} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete KM post</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={saving}
          onPress={() => void saveRecord()}
          style={[styles.primaryButton, saving && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save to KMPOS'}</Text>
        </Pressable>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex: { flex: 1 },
  content: { padding: 18, paddingBottom: 32 },
  header: {
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#111',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 5 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
  },
  cardTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginTop: 14 },
  optional: { color: '#94a3b8', fontWeight: '400' },
  sectionLabel: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginTop: 22 },
  helperText: { color: '#64748b', fontSize: 13, lineHeight: 18, marginTop: 5 },
  photoPreview: {
    borderRadius: 8,
    height: 180,
    marginTop: 12,
    width: '100%',
  },
  placementMap: { borderRadius: 10, height: 220, marginTop: 12 },
  coordinatesText: { color: '#0369a1', fontSize: 13, fontWeight: '700', marginTop: 8 },
  input: {
    alignSelf: 'stretch',
    borderColor: '#d0d0d0',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 6,
    padding: 12,
  },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    borderColor: '#dc2626',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  deleteButtonText: { color: '#b91c1c', fontWeight: '700', textAlign: 'center' },
  captureRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  secondaryButton: {
    borderColor: '#0284c7',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  secondaryButtonText: { color: '#0369a1', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  streetViewButton: {
    alignSelf: 'stretch',
    borderColor: '#16a34a',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
});