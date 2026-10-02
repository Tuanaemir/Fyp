export type KmPosRecord = {
  fid?: string | number;
  highway?: string;
  route_no?: string;
  sec_no?: string;
  pri_desc1?: string;
  dist_1?: string | number;
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

// localhost points to the Mac when the app runs in the iOS Simulator.
export const SERVER_URL = 'http://localhost:4000';

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

export async function checkApiHealth() {
  return request<HealthResponse>('/api/data/health');
}

export async function getKmPosts(highway?: string) {
  const query = highway ? `?highway=${encodeURIComponent(highway)}` : '';
  return request<KmPostsResponse>(`/api/data/geojson${query}`);
}

export async function fetchKmPosRecords(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}&limit=100` : '?limit=500';
  const response = await request<Record<string, unknown>[]>(`/api/km-pos${query}`);
  return response.map((record) => ({
    ...record,
    longitude: Number(record.Longitude ?? record.longitude) || null,
    latitude: Number(record.Latitude ?? record.latitude) || null,
  })) as KmPosRecord[];
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

export async function updateKmPos(fid: number, data: KmPosUpdate) {
  return request<KmPosRecord>(`/api/km-pos/${fid}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
