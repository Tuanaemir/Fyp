# KMPOS Mobile

Expo/React Native mobile client for viewing, searching, adding, editing, and deleting KM posts.

## API configuration

The app uses `EXPO_PUBLIC_API_URL` when provided. Copy `.env.example` to `.env` and set the computer's LAN address for a physical device:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000
```

Defaults:

- Android emulator: `http://10.0.2.2:4000`
- iOS simulator and web: `http://localhost:4000`
- Physical Android/iPhone: `http://YOUR_COMPUTER_IP:4000`

The API server must listen on a network-accessible interface for physical devices, and the phone and computer must share a network.

## Run

```bash
npm install
npx expo start
```

Then press:

- `a` for an Android emulator
- `i` for an iOS simulator
- `w` for web

For a physical device, scan the Expo QR code with Expo Go or use a development build. Restart Expo after changing `.env`.

## Mobile features

- Clustered map markers on web and bounded marker rendering on native maps
- KM post search with debounced input
- Tap-to-place and draggable marker placement on native maps
- Full KM post details and field capture form
- Add, edit, and confirmed delete actions
- Street View links and signboard photo capture
- API health indicator and cached records when the network is temporarily unavailable
- Virtualized records list for smoother scrolling
