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
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addKmPost,
  fetchKmPosRecords,
  getPhotoUrl,
  updateKmPos,
  uploadKmPostPhoto,
} from '@/services/api';

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ fid?: string }>();
  const editing = Boolean(params.fid);
  const [fid] = useState(params.fid ?? '');
  const [routeNo, setRouteNo] = useState('');
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

  async function saveRecord() {
    const recordId = Number(fid);
    if (editing && (!Number.isInteger(recordId) || recordId < 1)) {
      Alert.alert('Invalid record ID', 'Enter a positive integer fid.');
      return;
    }
    if (!routeNo.trim() && !coordinates) {
      Alert.alert('Add marker details', 'Enter a route number or capture your GPS location.');
      return;
    }

    try {
      setSaving(true);
      const data = {
        route_no: routeNo.trim() || undefined,
        state: state.trim() || undefined,
        district: district.trim() || undefined,
        google_street_view: streetView.trim() || undefined,
        ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
        remarks: photoUri ? `Photo captured: ${photoUri}` : undefined,
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
        <Text style={styles.label}>Route number</Text>
        <TextInput value={routeNo} onChangeText={setRouteNo} placeholder="Route number (example: 1)" style={styles.input} />
        <Text style={styles.label}>State</Text>
        <TextInput value={state} onChangeText={setState} placeholder="State" style={styles.input} />
        <Text style={styles.label}>District</Text>
        <TextInput value={district} onChangeText={setDistrict} placeholder="District" style={styles.input} />
        <Text style={styles.label}>Street View link <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput value={streetView} onChangeText={setStreetView} placeholder="Street View URL (optional)" style={styles.input} />
        <Text style={styles.sectionLabel}>Field capture</Text>
        <Text style={styles.helperText}>
          Take a clear photo of the KM road signboard at this location.
        </Text>
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
  input: {
    alignSelf: 'stretch',
    borderColor: '#d0d0d0',
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 6,
    padding: 12,
  },
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