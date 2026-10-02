# KM Marker & Map Context Mobile Application

## 1. Overview & System Purpose

### 1.1 Purpose

KM Marker & Map Context is a field-mapping mobile application for recording, locating,
and maintaining Malaysian kilometre-post (KM post) infrastructure. A field worker can
view existing markers on a map, search by route/state/district, capture the device
position, photograph a signboard, and save the marker record to the KMPOS API.

The broader system is intended to provide:

- **Kilometre-post navigation:** identify the road reference nearest to a field
  worker's current position.
- **Geotagging:** associate a marker, photograph, and metadata with latitude and
  longitude.
- **Emergency reference:** provide a consistent route/KM location payload for
  roadside incidents and emergency dispatch.
- **JKR and highway infrastructure mapping:** maintain Federal, State, and highway
  route context, including marker status and Street View references.

The current repository implements the map-record and field-capture workflow. Automatic
road/KM resolution, EXIF parsing, local offline storage, and emergency/work-order
submission should be treated as planned capabilities until their services are added.

### 1.2 Target devices and use cases

The application targets current Android and iOS phones in portrait orientation. The
same Expo project can also run on the web for map-record administration, but field
capture should be tested on physical mobile devices because GPS and camera behavior
are not representative in a browser or simulator.

Typical mobile use cases are:

1. **Roadside emergency reporting:** capture the current position and route reference,
   then send a concise location payload to a dispatch system.
2. **Maintenance tagging:** photograph a damaged, missing, or replaced KM board and
   update its route, state, district, and remarks.
3. **Survey and data correction:** search the marker list, open a record, correct
   coordinates or classification, and optionally open a Street View link.
4. **Poor-connectivity surveying:** use a locally cached road index and queue changes
   for later synchronization. This is a target design; the current app requires the
   API for reads and writes.

## 2. Mobile Architecture & Tech Stack

### 2.1 Verified implementation

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Application framework | Expo SDK 57 with React Native 0.86 | Cross-platform Android, iOS, and web application |
| Language | TypeScript and TSX | UI, API types, and business logic |
| Navigation | Expo Router | File-based routes under `src/app/` |
| Native map | `react-native-maps` 1.27 | Marker rendering on Android and iOS |
| Web map | MapLibre GL 6.11 | OSM Bright style and interactive markers on web |
| Device location | `expo-location` | Foreground permission and current-position capture |
| Camera/photo picker | `expo-image-picker` | Camera capture and photo-library access |
| API client | Typed `fetch` wrapper | REST requests, JSON parsing, and multipart photo upload |
| Native generation | Expo config plugins/CNG | Permissions and native configuration from `app.json` |

The primary screens are:

- `src/app/index.tsx`: application home/tab entry.
- `src/app/records.tsx`: searchable marker list.
- `src/app/capture.tsx`: add or edit a marker, capture GPS, and capture/upload a
  signboard image.
- `src/components/marker-map.tsx`: native and web map implementations.
- `src/services/api.ts`: shared API types and request functions.

### 2.2 Mapping and geolocation

On Android and iOS, the map uses `react-native-maps` and renders records as native
map markers. On web, MapLibre loads
`https://tiles.tuxgeo.dev/styles/osm-bright.json`. The device location is obtained
with `Location.getCurrentPositionAsync` after
`Location.requestForegroundPermissionsAsync`.

The current map centers on Kuala Lumpur (`3.139, 101.6869`) when no user location
has been applied. A production marker engine should use the returned GPS accuracy,
the nearest road segment, and the route's calibrated KM origin rather than treating
straight-line distance to a marker as authoritative.

### 2.3 Storage, caching, and offline strategy

There is currently no SQLite, Realm, or tile-cache dependency in the project.
Records are fetched from the API and photos are uploaded through the API. A
production offline mode should use the following layers:

1. **SQLite metadata store:** route index, marker records, sync state, and an
   outbox of pending writes.
2. **Road-boundary cache:** versioned Federal, State, and highway route geometry
   covering the survey region.
3. **Map tile cache:** bounded, user-selected rural route areas; enforce a size and
   retention policy.
4. **Conflict handling:** use `updated_at`/record version values and expose a
   conflict state instead of silently overwriting a server edit.

Offline mode must clearly show the age of cached data and must never present a
stale cached marker as a confirmed emergency location without an accuracy warning.

## 3. Core Features & Navigation Components

### 3.1 Marker lookup and detection

The intended resolution pipeline is:

1. Request a foreground GPS fix.
2. Reject or warn on a fix whose accuracy exceeds the configured field threshold.
3. Match the point to the nearest supported road segment.
4. Determine the route code and road category.
5. Project the point along the route's calibrated centreline.
6. Calculate the nearest KM post and optional 100 m hectometer value.
7. Return the marker plus distance, GPS accuracy, and resolution confidence.

The repository currently captures step 1 and saves latitude/longitude; it does not
yet implement steps 2–7. A resolver should return a confidence/status value such as
`RESOLVED`, `LOW_ACCURACY`, `OFF_ROUTE`, or `NO_ROUTE_DATA`.

#### Recommended TypeScript model

```ts
export type RoadType = 'HIGHWAY' | 'FEDERAL' | 'STATE';

export interface KMMarkerPayload {
  routeCode: string; // E2, FT009, D11
  roadType: RoadType;
  kmPost: number; // whole-kilometre marker
  hectometer?: number; // 0.1 km increments, represented as 0..9 or 0.0..0.9 by API contract
  coordinates: {
    latitude: number;
    longitude: number;
  };
  accuracyMeters?: number;
  distanceToRouteMeters?: number;
  resolutionStatus?: 'RESOLVED' | 'LOW_ACCURACY' | 'OFF_ROUTE' | 'NO_ROUTE_DATA';
}
```

Use one hectometer convention throughout the system. The example value `15.2` is
ambiguous because it may mean kilometre 15.2 or hectometer 2 at KM 15. Prefer
`kmPost: 15, hectometer: 2` for a normalized model, or document a decimal-kilometre
field explicitly.

### 3.2 Road classification engine

Road classification is a parser and validation layer, not just a display label.
The initial protocol is:

| Category | Expected route-code form | Examples |
| --- | --- | --- |
| Highway | `E` followed by digits | `E2` |
| Federal | `FT` followed by a three-digit number | `FT001`, `FT009` |
| State | State route series agreed with JKR data | `D11`, `A12` |

The State series must be driven by the authoritative JKR route table rather than a
hard-coded assumption that every letter from A to R is valid in every state. The
parser should normalize case and whitespace, reject unknown codes, and preserve the
original source value for audit.

### 3.3 Photo and metadata tagging

The current capture screen requests camera permission, launches the system camera,
shows a local preview, and uploads the image as a multipart JPEG. It does not extract
EXIF GPS or read a KM number from pixels.

The planned tagging flow is:

1. Capture/select the image.
2. Read EXIF GPS (`GPSLatitude`, `GPSLongitude`, and their references).
3. Normalize coordinates to signed decimal degrees.
4. Run the same marker resolver used by live GPS.
5. Use OCR or user confirmation for the printed KM value; never silently replace
   the server marker from OCR alone.
6. Store the original image, normalized metadata, and extraction confidence.

A photo without EXIF must fall back to the device GPS captured at the time of
capture, with an explicit `source: "DEVICE_GPS"` value.

### 3.4 Emergency and work-order flow

The recommended flow is:

1. Select **Emergency** or **Maintenance**.
2. Capture GPS and show accuracy/nearest route.
3. Confirm route code, road type, KM, hectometer, severity, and notes.
4. Attach one or more compressed photos.
5. Submit immediately when online or place in the offline outbox.
6. Display a server-generated incident/work-order ID and sync state.

The existing `/api/data` marker create/update flow is not an emergency dispatch
endpoint. Add a dedicated endpoint and authorization policy before presenting a
marker edit as a dispatched incident.

## 4. API Integration & Data Schema

### 4.1 Existing REST endpoints

The mobile API client currently uses `SERVER_URL = http://localhost:4000`.
`localhost` points to the development computer from an iOS simulator; a physical
device normally needs a LAN-reachable HTTPS host or a development tunnel.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/data/health` | API/database health check |
| GET | `/api/data/geojson?highway={code}` | GeoJSON marker collection, optionally filtered |
| GET | `/api/km-pos?search={text}&limit={n}` | Search/list marker records |
| POST | `/api/data` | Create a marker |
| PUT | `/api/data/{fid}` | Replace/update a marker |
| PATCH | `/api/km-pos/{fid}` | Partially update a marker |
| POST | `/api/data/{fid}/photo` | Multipart signboard-photo upload |
| DELETE | `/api/data/{fid}` | Delete a marker |

The client throws an error for non-2xx responses and preserves the response body in
the error message. Production deployments should use HTTPS, authenticated
requests, request IDs, server-side validation, and environment-specific base URLs.

### 4.2 Existing marker schema

```json
{
  "fid": 1024,
  "route_no": "FT009",
  "state": "Selangor",
  "district": "Petaling",
  "Latitude": 3.139,
  "Longitude": 101.6869,
  "photo_url": "/uploads/signboard-1024.jpg",
  "Google_StreetView": "https://www.google.com/maps/@?api=1&map_action=pano",
  "Checked_StreetView": true,
  "Remarks": "Field inspection completed"
}
```

The client normalizes `Latitude`/`Longitude` to numeric `latitude`/`longitude`
aliases. API responses should eventually use one canonical casing and field naming
convention to avoid duplicate mapping logic.

### 4.3 Recommended resolution payload

```json
{
  "routeCode": "E2",
  "roadType": "HIGHWAY",
  "kmPost": 125,
  "hectometer": 2,
  "coordinates": {
    "latitude": 3.139,
    "longitude": 101.6869
  },
  "accuracyMeters": 8.4,
  "distanceToRouteMeters": 12.1,
  "resolutionStatus": "RESOLVED"
}
```

### 4.4 Recommended endpoint additions

For the target feature set, add:

- `GET /api/routes/{routeCode}/markers/nearest?lat={lat}&lon={lon}`:
  nearest-marker resolution.
- `GET /api/routes/context?bbox={west},{south},{east},{north}`:
  bounded route/road context for map and offline downloads.
- `POST /api/incidents`: emergency location and evidence submission.
- `POST /api/work-orders`: maintenance request with boundary and severity.
- `POST /api/sync`: authenticated, idempotent outbox synchronization.

Return `accuracyMeters`, `distanceToRouteMeters`, `dataVersion`, and
`resolutionStatus` so the mobile UI can explain uncertainty.

## 5. Device Permissions, Testing & Deployment

### 5.1 Permissions

The current `app.json` configures:

- **Foreground location:** `expo-location` with the message “Allow KMPOS Mobile to
  use your location to capture field markers.”
- **Camera:** `expo-image-picker` camera permission.
- **Photo library:** `expo-image-picker` photo access.
- **Microphone:** explicitly disabled for ImagePicker because the app captures still
  images, not video/audio.

The app requests permissions at the point of use and displays an actionable alert
when a user denies access. Background location is not configured. Add it only if
continuous background tracking is a confirmed product requirement; it requires
additional platform review, disclosure, battery testing, and configuration.

Network state is not currently requested or monitored. For offline sync, add a
network-state module and treat connectivity as advisory: requests still need
timeouts, retries, idempotency keys, and an outbox.

### 5.2 Testing strategy

Test on physical devices with:

- GPS enabled and disabled.
- Accurate, low-accuracy, and stale location fixes.
- Camera/photo permission granted, denied, and revoked in system settings.
- No network, intermittent network, slow API, and API error responses.
- A physical device outside the developer's Wi-Fi to verify the base URL.
- Portrait layouts, safe-area insets, keyboard interaction, and large text.
- Malaysian route examples for Highway, Federal, and State classifications.

Minimum automated tests should cover route parsing, coordinate normalization,
nearest-marker calculations, hectometer rounding, API error handling, and outbox
retry/idempotency. Use mock GPS/API fixtures; do not make unit tests depend on
`localhost` or live map tiles.

### 5.3 Local development

```bash
npm install
npx expo start
npx expo lint
npx tsc --noEmit
```

For a physical device, replace the development API host with a reachable address.
Do not hard-code production credentials or a production API URL in source control.
Because `react-native-maps` contains native code, use a compatible development
build when Expo Go does not include the required native configuration.

### 5.4 Android release

1. Configure a stable Android application ID, version code, permissions, icons, and
   HTTPS API environment.
2. Build a development APK for field acceptance testing.
3. Run GPS, camera, offline, and upload tests on representative Android versions.
4. Build a signed **AAB** for Google Play production distribution. Use an **APK**
   only for direct/internal installation where appropriate.
5. Retain signing credentials in the build service or secure CI secret storage.

Use EAS Build for repeatable cloud builds when the project has an `eas.json`
profile. Never commit keystores, service-account keys, or API secrets.

### 5.5 iOS release

1. Configure the bundle identifier, signing team, location/camera/photo usage
   descriptions, and App Store privacy declarations.
2. Produce a development build and test on a physical iPhone.
3. Archive and upload through EAS Submit/Xcode tooling.
4. Distribute to internal testers through TestFlight.
5. Validate the production API, privacy text, crash reporting, and review notes
   before App Store submission.

## 6. Feature Checklist and Guided Learning Path

### 6.1 Current/target checklist

- [x] Search and list existing marker records.
- [x] Render records on native and web maps.
- [x] Capture foreground GPS coordinates.
- [x] Capture and upload a signboard photo.
- [x] Edit route, state, district, coordinates, and Street View link.
- [ ] Resolve the nearest KM post from live coordinates.
- [ ] Parse and validate Federal, State, and Highway route protocols.
- [ ] Extract EXIF GPS and reconcile it with device GPS.
- [ ] OCR/confirm printed KM values.
- [ ] Cache route boundaries, markers, and selected map tiles.
- [ ] Queue offline writes and synchronize safely.
- [ ] Submit emergency incidents and maintenance work orders.

### 6.2 Learn one step at a time

1. **Understand the route:** open `src/app/records.tsx`, search for a route or
   district, and select a marker.
2. **Understand field capture:** open `src/app/capture.tsx`; capture GPS, take a
   signboard photo, and save the record.
3. **Understand persistence:** trace `saveRecord()` into `src/services/api.ts` and
   identify the POST/PATCH request and multipart photo upload.
4. **Understand map rendering:** compare the native `react-native-maps` branch with
   the web MapLibre branch in `src/components/marker-map.tsx`.
5. **Add marker resolution:** implement a pure function that accepts coordinates and
   a route index, then test it without React Native.
6. **Add metadata and offline sync:** introduce EXIF normalization, SQLite/outbox
   persistence, and explicit sync states only after the online flow is reliable.
7. **Add emergency/work-order APIs:** keep dispatch records separate from ordinary
   marker CRUD and require server acknowledgement.

The safest teaching sequence is to complete and test one step before moving to the
next. In particular, do not call a coordinate “resolved” until route distance and
GPS accuracy have been evaluated.
