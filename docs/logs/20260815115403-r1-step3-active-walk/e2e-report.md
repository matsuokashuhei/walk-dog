# iOS E2E result

## Executed checks

- `aws sts get-caller-identity --profile walk-dog` succeeded (`arn:aws:sts::967026628831:assumed-role/AWSReservedSSO_walk-dog_5388bc4607b257b0/matsuokashuhei`) before any Verify/OTP step. The session was already signed in from the prior Dog slice (display name set, dog `Mugi` present).
- Worktree API on `http://127.0.0.1:3000` returned `GET /health` `200`. Walks migrations were already applied (`GET /v1/walks/active` returned `204` before the first start).
- iPhone 17 Pro simulator (`C01CDE0B-DAF2-4466-9C9B-41E63A0CBEDE`, iOS 26.2) ran the SDK 57 development client (`expo@57.0.13`, `ExpoModulesCore` 57.0.11, `ExpoLocation` 57.0.10) against Metro on `8081`.
- Native rebuild was required after the launch dyld crash (`Symbol not found: BaseModule.willDestroy` in `ExpoLocation.framework`). Aligning `expo-modules-core` to 57.0.11 and reinstalling pods removed the crash; the app stayed in the foreground on Dogs with tabs Dogs / Walk.
- Walk tab with `Mugi` selected and location unset showed `位置情報（使用中および常に）を許可してください。` and `位置情報を許可`.
- After `simctl privacy grant location` + `location-always`, Apple MapKit showed the current-location puck and enabled `開始する`.
- `POST /v1/walks` returned `201`. The in-flight Starting screen showed `開始しています` / `開始しています…` with participant `Mugi`.
- Recording showed `記録中`, elapsed timer, participant `Mugi`, and `終了する`.
- `POST /v1/walks/:walkId/finish` returned `200`. Completed showed `散歩が完了しました`, `0 m` distance, and `Ready へ戻る`.
- A later Recording session had location revoked (`simctl privacy revoke location` / `location-always`), then the app was backgrounded via Settings and foregrounded. Walk showed Failed: `記録に失敗しました` / `この散歩は破棄されました。`

## Commands

```bash
# API (worktree) with host Postgres — already running
cd apps/api
set -a && source /Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/apps/.env.local && set +a
export POSTGRES_HOST=127.0.0.1 AWS_PROFILE=walk-dog AWS_REGION=ap-northeast-1
npm run dev
# GET /health 200 on http://127.0.0.1:3000

# Native rebuild after ExpoLocation / ExpoModulesCore ABI align
cd apps/mobile
export EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
npx expo run:ios --device C01CDE0B-DAF2-4466-9C9B-41E63A0CBEDE

# Metro (after rebuild)
env -u CI npx expo start --port 8081 --dev-client

# Simulator + app drive (agent-device)
xcrun simctl boot C01CDE0B-DAF2-4466-9C9B-41E63A0CBEDE
# open com.cacheandbuffer.walkdog → Walk tab
# select Mugi (location unset) → ios-walk-ready-location.png
# grant location + location-always → map puck + 開始する → ios-walk-startable.png
# 開始する → Starting → ios-walk-starting.png → Recording → ios-walk-recording.png
# 終了する → Completed 0 m → ios-walk-completed.png
# start again → revoke location → background Settings → foreground → Failed → ios-walk-failed.png
```

API log evidence:

```text
POST /v1/walks status=201 requestId=8a0c91dc-b84d-4df9-a0fb-106e40e554f7
POST /v1/walks/:walkId/finish status=200 requestId=3802276b-e3fb-4096-a74e-2d2b3ca7735c
POST /v1/walks status=201 requestId=9c284bdc-d686-4430-a5cc-f64af0ff1563
POST /v1/walks/:walkId/finish status=200 requestId=93ae164f-873f-4bf6-b643-4168cc0d6ce5
POST /v1/walks status=201 requestId=c4d379f4-4ed4-424a-a7a8-a59b67d88bad
```

The last `201` is the Recording session used for Failed (location revoked). Completed evidence uses the finish `200` rows above; the Completed PNG shows `0 m`.

## Screenshot attachment

![Location required](screenshots/ios-walk-ready-location.png)

![Startable with map](screenshots/ios-walk-startable.png)

![Starting](screenshots/ios-walk-starting.png)

![Recording](screenshots/ios-walk-recording.png)

![Completed](screenshots/ios-walk-completed.png)

![Failed](screenshots/ios-walk-failed.png)

## Result

The iOS E2E completed on an iPhone 17 Pro simulator with the SDK 57 development client. Location-required validation (`位置情報（使用中および常に）を許可してください。`), startable map with current-location puck, Starting, Recording, Completed (`0 m` after `POST .../finish` `200`), and Failed after location revoke were captured.
