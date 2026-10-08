import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KM_POSTS_CACHE_KEY = '@kmposts/records';

const defaultServerUrl = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

// Set EXPO_PUBLIC_API_URL to the computer's LAN URL for a physical device.
export const SERVER_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() || defaultServerUrl
).replace(/\/+$/, '');

// --- Types ---
export type KmPosRecord = {
  fid?: string | number;
  highway?: string;
  route_no?: string;
  sec_no?: string;
  pri_desc1?: string;
  dist_1?: string | number;
  sec_des2?: string;
  dist_2?: string | number;
  pri_des3?: string;
  dist_3?: string | number;
  sec_des4?: string;
  dist_4?: string | number;
  district?: string;
  state?: string;
  pemilik?: string;
  type?: string;
  Status?: string;
  Longitude?: string | number;
  Latitude?: string | number;
  Google_StreetView?: string;
  Checked_StreetView?: boolean;
  Remarks?: string;
  // Normalized aliases returned by the mobile API.
  longitude?: number | null;
  latitude?: number | null;
  'Google StreetView'?: string | null;
  photo_url?: string | null;
};

export type GeoJsonFeature = {
  type: 'Feature';
  properties: KmPosRecord & { kilometer?: number };
  geometry: {
    type: 'Point';
    coordinates: [number, number] | null;
  };
};

export type KmPostsResponse = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

export type HealthResponse = {
  status: string;
  database: string;
  rows: number;
};

export type KmPosUpdate = {
  route_no?: string;
  state?: string;
  district?: string;
  google_street_view?: string | null;
  latitude?: number;
  longitude?: number;
  remarks?: string | null;
  checked_street_view?: boolean;
};

// --- Core Request Wrapper ---
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers:
      options?.body instanceof FormData
        ? options.headers
        : {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
          },
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${responseText}`);
  }

  return responseText ? (JSON.parse(responseText) as T) : (undefined as T);
}

// --- Generic Helper (formerly fetchBackendData) ---
export const fetchBackendData = async (endpoint = '/api/your-endpoint') => {
  return request<any>(endpoint);
};

// --- API Methods ---
export async function checkApiHealth() {
  return request<HealthResponse>('/api/data/health');
}

export async function getKmPosts(highway?: string) {
  const query = highway ? `?highway=${encodeURIComponent(highway)}` : '';
  return request<KmPostsResponse>(`/api/data/geojson${query}`);
}

export async function fetchKmPosRecords(search = '') {
  let response: KmPostsResponse;
  try {
    response = await request<KmPostsResponse>('/api/data/geojson');
    await AsyncStorage.setItem(KM_POSTS_CACHE_KEY, JSON.stringify(response));
  } catch (error) {
    const cached = await AsyncStorage.getItem(KM_POSTS_CACHE_KEY);
    if (!cached) throw error;
    response = JSON.parse(cached) as KmPostsResponse;
  }
  const records = response.features.map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates ?? [null, null];

    return {
      ...feature.properties,
      longitude: Number(feature.properties.Longitude ?? longitude) || null,
      latitude: Number(feature.properties.Latitude ?? latitude) || null,
    };
  }) as KmPosRecord[];

  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return records;

  return records.filter((record) =>
    [record.fid, record.highway, record.route_no, record.district, record.state]
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  );
}

export async function getKmPostsGeoJson() {
  return request<KmPostsResponse>('/api/data/geojson');
}

export async function addKmPost(record: KmPosRecord) {
  return request<KmPosRecord>('/api/data', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export function getPhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return null;
  return photoUrl.startsWith('http') ? photoUrl : `${SERVER_URL}${photoUrl}`;
}

export async function uploadKmPostPhoto(fid: string | number, uri: string) {
  const formData = new FormData();
  formData.append('photo', {
    uri,
    name: `signboard-${fid}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);

  return request<{ fid: number; photo_url: string }>(
    `/api/data/${encodeURIComponent(String(fid))}/photo`,
    {
      method: 'POST',
      body: formData,
    },
  );
}

export async function updateKmPost(fid: string | number, record: KmPosRecord) {
  return request<KmPosRecord>(`/api/data/${encodeURIComponent(String(fid))}`, {
    method: 'PUT',
    body: JSON.stringify(record),
  });
}

export async function deleteKmPost(fid: string | number) {
  await request<void>(`/api/data/${encodeURIComponent(String(fid))}`, {
    method: 'DELETE',
  });
}

export async function updateKmPos(fid: number, data: Partial<KmPosRecord>) {
  return request<KmPosRecord>(`/api/data/${encodeURIComponent(String(fid))}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}