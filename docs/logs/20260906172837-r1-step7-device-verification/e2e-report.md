---
status: passed
---

# R1 Step 7 Device Verification — iOS E2E

Physical iPhone + LAN Compose で、起動／Foreground／タブ照合、Background TrackPoint、Active 消失 → Failed、通信復帰の自動再送を確認した。シミュレータは使っていない。

## Environment

| Item | Observed value |
| --- | --- |
| Checkout | `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step7-device-verification-20260906172837` |
| Branch / HEAD at evidence | `agent/r1-step7-device-verification-20260906172837` |
| Device | Shuhei’s iPhone, iPhone 14 Pro (`iPhone15,2`), iOS 26.6.2, UDID `00008120-001A2DE83A3B401E` |
| Drive method | iPhone Mirroring + Accessibility HID (`osascript` / JXA `CGEvent`). Simulator unused. |
| App | `com.cacheandbuffer.walkdog` + Metro `http://192.168.68.64:8082` |
| API URL | `EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000` |
| Compose health | `GET http://127.0.0.1:3000/health` 200; `GET http://192.168.68.64:3000/health` 200 |
| AWS SSO | `amazon/aws-cli sts get-caller-identity --profile walk-dog` succeeded (`matsuokashuhei`) |
| Run window | 2026-09-12 16:05–16:35 JST |

Visible Recording chrome is **記録中** and **終了する**. Failed chrome is **記録に失敗しました** / **この散歩は破棄されました。** / **Ready へ戻る**.

## Commands

```sh
ipconfig getifaddr en0   # 192.168.68.64
curl --fail http://127.0.0.1:3000/health
curl --fail http://192.168.68.64:3000/health
docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sts get-caller-identity --profile walk-dog
xcrun devicectl device process terminate --device 00008120-001A2DE83A3B401E --pid 3612 --kill
xcrun devicectl device process launch --device 00008120-001A2DE83A3B401E --activate \
  --payload-url 'exp+walk-dog://expo-development-client/?url=http%3A%2F%2F192.168.68.64%3A8082' \
  com.cacheandbuffer.walkdog
xcrun devicectl device process launch --device 00008120-001A2DE83A3B401E --activate com.apple.mobilesafari
# E: mark Active gone
# UPDATE walks SET state = 'failed' WHERE walk_id = '01a0946f-ec26-70b4-a007-f6c277f6862f'
# F
docker compose -f apps/compose.yml stop api
docker compose -f apps/compose.yml start api
```

## Scenario results

| Scenario | UI evidence | API / data evidence | Result |
| --- | --- | --- | --- |
| A — Launch restore | SIGKILL + relaunch, Walk tab shows **記録中**, elapsed 11:26, **終了する**, map + pin | Walk `01a0946f-ec26-70b4-a007-f6c277f6862f` stayed `recording` | pass |
| B — Foreground reconcile | Safari ≥15 s then return; Walk shows **記録中** 13:14 and **終了する** | Recording retained after AppState `active` | pass |
| C — Tab reconcile | Dogs → Walk returns **記録中**, elapsed 13:19, **終了する** | Same Recording after tab focus | pass |
| D — Background location | Safari ≥30 s then Walk still **記録中** (16:03). Device stayed put so distance stayed 0 m | Four `POST /v1/walks/:walkId/track-points` **201** during the background minute (last `2026-09-12T07:20:21Z`). Walk later held 84 `walk_track_points` rows | pass |
| E — Active disappearance | After `state=failed` and Foreground return: **記録に失敗しました**, **この散歩は破棄されました。**, **Ready へ戻る** | Active walk `01a0946f-…` is `failed`; later TrackPoint posts returned **409** (3 observed) | pass |
| F — Network recovery | Fresh Recording `01a09488-54e7-7649-a9d8-3363d2630acb` stayed **記録中** / **終了する** after API stop/start; map visible at 16:35 (elapsed 3:01) | See send evidence below | pass |

### F send evidence

`POST /v1/walks` **201** at `2026-09-12T07:32:37.740Z` created walk `01a09488-54e7-7649-a9d8-3363d2630acb`. TrackPoints **201** continued until API stop (last **201** `07:34:47.952Z`). After `docker compose start api` and LAN `/health` **200**, the API accepted two **201**s in a 30 ms burst at `07:35:21.506Z` and `07:35:21.536Z`, then `07:35:24.851Z` and `07:35:36.450Z`. That pair at `07:35:21Z` is the outbound-queue drain. Postgres later counted 32 `walk_track_points` for this walk. UI remained Recording.

## Screenshots

### A — Launch restore

![Launch restore Recording](screenshots/ios-walk-reconcile-restart-recording.png)

### B — Foreground reconcile

![Foreground Recording](screenshots/ios-walk-reconcile-foreground-recording.png)

### C — Tab reconcile

![Tab Recording](screenshots/ios-walk-reconcile-tab-recording.png)

### D — Background TrackPoint

![Background TrackPoint](screenshots/ios-walk-background-trackpoint.png)

### E — Active missing → Failed

![Active missing Failed](screenshots/ios-walk-reconcile-active-missing-failed.png)

### F — Network recovery

![Network recovery Recording](screenshots/ios-walk-network-recovery-recording.png)
