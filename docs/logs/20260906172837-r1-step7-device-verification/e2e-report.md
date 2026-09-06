---
status: blocked
---

# R1 Step 7 Device Verification — iOS E2E

Physical-iPhone scenarios A–F did not run. The iPhone is selectable over CoreDevice, Compose LAN health is 200, and AWS SSO is valid. Native install of `com.cacheandbuffer.walkdog` failed on Apple Program License Agreement and missing development profiles. Simulator was not used.

## Environment

| Item | Observed value |
| --- | --- |
| Checkout | `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step7-device-verification-20260906172837` |
| Branch / commit at start | `agent/r1-step7-device-verification-20260906172837` / `88cab12` |
| Device | Shuhei’s iPhone, iPhone 14 Pro (`iPhone15,2`), iOS 26.6.1, UDID `00008120-001A2DE83A3B401E`, CoreDevice `60CDD5CA-0DAA-50FA-B0A2-268D29F8A1FF` |
| Device connection | `devicectl`: available (paired), `transportType=localNetwork`, `tunnelState=connected`, Developer Mode enabled, DDI usable. `xctrace` lists the same phone under Devices Offline. `xcdevice` / `xcodebuildmcp device list`: available. |
| App on device | walk-dog not installed (listed apps are unrelated). No existing `Debug-iphoneos` binary in DerivedData (simulator-only `.app` copies exist). |
| API URL | `EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000` in `apps/mobile/.env` |
| Compose | `GET http://127.0.0.1:3000/health` 200 `{"status":"ok"}`; `GET http://192.168.68.64:3000/health` 200 `{"status":"ok"}`. api, worker, postgres (healthy), elasticmq, dynamodb up. |
| AWS SSO | `docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sts get-caller-identity --profile walk-dog` succeeded (`arn:aws:sts::967026628831:assumed-role/AWSReservedSSO_walk-dog_5388bc4607b257b0/matsuokashuhei`). OTP was not requested. |
| Signing | Expo selected `Apple Development: matzuokashuhei@gmail.com (D6K28S9P9J)`. Build stopped on PLA + missing profile. |

## Commands

```sh
docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sts get-caller-identity --profile walk-dog
curl --fail http://127.0.0.1:3000/health
curl --fail http://192.168.68.64:3000/health
xcrun xctrace list devices
xcrun devicectl list devices
xcrun xcdevice list
# apps/mobile:
# EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo run:ios --device 00008120-001A2DE83A3B401E -p 8082
```

`npx expo run:ios` completed prebuild and CocoaPods, then `xcodebuild` exited 65:

```text
Unable to process request - PLA Update available: You currently don't have access
to this membership resource. To resolve this issue, agree to the latest Program
License Agreement in your developer account. (in target 'mobile' from project 'mobile')

No profiles for 'com.cacheandbuffer.walkdog' were found: Xcode couldn't find any
iOS App Development provisioning profiles matching 'com.cacheandbuffer.walkdog'.
```

## Scenario results

| Scenario | UI evidence | API / data evidence | Result |
| --- | --- | --- | --- |
| A — Launch restore | Not run | — | blocked |
| B — Foreground reconcile | Not run | — | blocked |
| C — Tab reconcile | Not run | — | blocked |
| D — Background location | Not run | — | blocked |
| E — Active disappearance | Not run | — | blocked |
| F — Network recovery | Not run. On-device outbound queue drain not observed. | — | blocked |

Required PNGs were not captured:

- `screenshots/ios-walk-reconcile-restart-recording.png`
- `screenshots/ios-walk-reconcile-foreground-recording.png`
- `screenshots/ios-walk-reconcile-tab-recording.png`
- `screenshots/ios-walk-background-trackpoint.png`
- `screenshots/ios-walk-reconcile-active-missing-failed.png`
- `screenshots/ios-walk-network-recovery-recording.png`

## Blocker

Apple Developer Program License Agreement is pending. Until it is accepted, Xcode cannot create or download an iOS App Development profile for `com.cacheandbuffer.walkdog`, so the development client cannot be installed on the physical iPhone.

**Human step:** open [https://developer.apple.com/account](https://developer.apple.com/account), sign in as the walk-dog Apple Development account, agree to the latest Program License Agreement, then retry from this worktree:

```sh
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo run:ios --device 00008120-001A2DE83A3B401E -p 8082
```

USB is not required for CoreDevice discovery (the phone is already paired on Wi‑Fi). If profile refresh still fails after PLA, connect the iPhone by USB, trust this Mac, and confirm the phone appears under Xcode → Window → Devices and Simulators as connected.
