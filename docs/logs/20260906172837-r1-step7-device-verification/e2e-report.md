---
status: blocked
---

# R1 Step 7 Device Verification — iOS E2E

The physical iPhone is unlocked, Developer Disk Image is mounted, and `com.cacheandbuffer.walkdog` is installed and connected to this worktree’s Metro. Scenarios A–F were not executed: iOS 26.6.2 does not expose CoreDevice HID touch, so the agent cannot dismiss the Expo menu, type Sign In, or drive Walk. Simulator was not used.

## Environment

| Item | Observed value |
| --- | --- |
| Checkout | `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step7-device-verification-20260906172837` |
| Branch / commit at start | `agent/r1-step7-device-verification-20260906172837` / `55000c6` |
| Device | Shuhei’s iPhone, iPhone 14 Pro (`iPhone15,2`), iOS 26.6.2 (23G90), UDID `00008120-001A2DE83A3B401E`, CoreDevice `60CDD5CA-0DAA-50FA-B0A2-268D29F8A1FF` |
| Device connection | USB. `devicectl` tunnel acquired. Developer Mode enabled. `passcodeRequired=false`, `unlockedSinceBoot=true`. DDI `isUsable=true`. |
| App on device | `mobile` `com.cacheandbuffer.walkdog` 1.0.0 (1) installed. Launched with `exp+walk-dog://expo-development-client/?url=http://192.168.68.64:8082`. Metro: `iOS Bundled` on port 8082. Foreground shows Sign In behind the Expo Dev Menu. |
| API URL | `EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000` |
| Compose | `GET http://127.0.0.1:3000/health` 200 `{"status":"ok"}`; `GET http://192.168.68.64:3000/health` 200 `{"status":"ok"}`. api, worker, postgres (healthy), elasticmq, dynamodb up. |
| AWS SSO | `amazon/aws-cli sts get-caller-identity --profile walk-dog` succeeded (`arn:aws:sts::967026628831:assumed-role/AWSReservedSSO_walk-dog_5388bc4607b257b0/matsuokashuhei`). OTP was not requested. |
| Signing | Team `CY4LJR5KMM`. `npx expo run:ios --device` Build Succeeded and installed. |

## Commands

```sh
ipconfig getifaddr en0   # 192.168.68.64
curl --fail http://127.0.0.1:3000/health
curl --fail http://192.168.68.64:3000/health
docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sts get-caller-identity --profile walk-dog
xcrun xcdevice list   # Shuhei’s iPhone available=true, interface=usb
xcrun devicectl device info lockState --device 00008120-001A2DE83A3B401E
xcrun devicectl device info ddiServices --device 00008120-001A2DE83A3B401E
# apps/mobile:
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo run:ios --device 00008120-001A2DE83A3B401E -p 8082
xcrun devicectl device process launch --device 00008120-001A2DE83A3B401E --activate \
  --payload-url 'exp+walk-dog://expo-development-client/?url=http%3A%2F%2F192.168.68.64%3A8082' \
  com.cacheandbuffer.walkdog
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

CoreDevice HID (`com.apple.coredevice.hid.universalhidservice` / Indigo) fails to start on this iOS 26.6.2 DDI (`Failed to start service`). Accessibility Activate does not dismiss the Expo menu or operate Sign In. iPhone Mirroring is installed, but `osascript` is not allowed assistive access, so the mirrored window cannot be clicked. WebDriverAgent is not installed.

**Human step:** In **System Settings → Privacy & Security → Accessibility**, enable **Cursor**. Open **iPhone Mirroring** so Shuhei’s iPhone is on this Mac. Keep the phone unlocked and USB-connected (Auto-Lock Off). Then retry Task 4 — Metro is already on `8082` with the app at Sign In.
