# Mobile local development

Expo SDK 57 development client for walk / dog. Requires a [development build](https://docs.expo.dev/develop/development-builds/introduction/) — Expo Go does not support the native modules used for location, maps, and secure session storage.

## Environment

Create the local environment file:

```bash
cd apps/mobile
cp .env.example .env
```

`EXPO_PUBLIC_API_BASE_URL` must be an absolute URL to the API. For the iOS Simulator with local Compose:

```
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
```

Rebuild the native app after changing `EXPO_PUBLIC_*` values.

## Run

```bash
npm install
npx expo run:ios
```

Start Metro separately when you need a fixed port or an isolated worktree:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000 npx expo start --port 8082
```

Point the Simulator development client at that Metro URL when prompted.

## Authentication session

The app stores Cognito tokens in `expo-secure-store` and attaches the access token to authenticated API requests.

When the API returns `401` with `code: "UNAUTHENTICATED"`, the client clears the stored session and returns to Sign In. The handler ignores stale 401 responses that belong to a superseded access token, so a successful re-sign-in is not undone by an in-flight request from the previous session.

## Location permissions

Walk Ready requires foreground and background location permission before Start is enabled.

| Permission state | Walk Ready UI |
| --- | --- |
| Foreground and background granted | Start is available when at least one Dog is selected |
| Not yet requested | Shows **位置情報を許可** and requests both permissions |
| Foreground or background denied | Shows **設定を開く** and opens iOS Settings |

When the app returns to the foreground on Walk Ready or Recording, permission state is re-read. iOS does not show the system dialog again after denial — use Settings to grant **使用中** and **常に**.

Recording uses Apple MapKit for the map background, a pin at the current location, and a path from TrackPoints received on the device.

## Tests

```bash
npm test
npm run lint
```

Unit tests cover API error handling, authentication expiry, session persistence ordering, and location-permission action selection.

## API dependency

Mobile development against a local API requires a healthy stack. From `apps`:

```bash
docker compose -f compose.yml up --build -d
curl --fail http://localhost:3000/health
```

See `apps/api/README.md` when `GET /health` returns `503`.
