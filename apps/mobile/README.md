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

## TrackPoint recording

During Recording, the app samples location every 10 seconds and sends each point to `POST /v1/walks/:walkId/track-points`.

| Layer | Module | Role |
| --- | --- | --- |
| Sampling | `walk-location-task.ts` | Foreground timer while active; `WALK_TRACK_POINT` background task while backgrounded |
| Queue | `walk-track-point-queue.ts` | 10 s deduplication, serialized record/flush, retry policy |
| Persistence | `walk-path-store.ts` | Path for map rendering; outbound queue for unsent points |
| API | `walk-api.ts` | `postTrackPoint` with `recordedAt`, `latitude`, `longitude` |

Each accepted sample is appended to the on-device path and outbound queue, then the queue is flushed in order. Retryable API errors keep the point in the queue and retry on the next sample or flush. Non-retryable errors (except `401`) drop the point.

Finish pauses sampling, flushes the outbound queue, then calls `POST /v1/walks/:walkId/finish`. The client waits for the API to confirm the walk is finished in DynamoDB before leaving Recording. Finish fails when any point remains queued after flush.

When finish fails, Recording stays active and **終了する** remains available for retry. A `503` with `code: "SERVICE_UNAVAILABLE"` shows the API message (for example「終了処理を完了できませんでした。もう一度お試しください。」). Other failures show a generic retry message.

### Authentication expiry during Recording

A TrackPoint `401` stops auto-retry and returns to Sign In, but does not fail the Active Walk on the server. Pending points stay in `walk-outbound-queue.json`. After re-sign-in, the app restores Recording from `GET /v1/walks/active` and resumes sampling and queue flush.

This differs from other authenticated requests: the global `401` handler ignores stale tokens from a superseded session, but TrackPoint `401` during Recording always clears the current session so the user can re-authenticate and drain the queue.

### On-device files

| File | Contents |
| --- | --- |
| `walk-path.json` | TrackPoints per `walkId`, used to draw the Recording path |
| `walk-outbound-queue.json` | Points waiting for `POST /track-points` |
| `walk-recording.json` | Active `walkId` while Recording |

## Tests

```bash
npm test
npm run lint
```

Unit tests cover API error handling, authentication expiry, session persistence ordering, location-permission action selection, and TrackPoint queue retry / `401` behavior.

## API dependency

Mobile development against a local API requires a healthy stack. From `apps`:

```bash
docker compose -f compose.yml up --build -d
curl --fail http://localhost:3000/health
```

See `apps/api/README.md` when `GET /health` returns `503`.
