---
status: blocked
---

# R1 Step 7 Device Verification — iOS E2E

Physical-iPhone scenarios A–F did not run. Apple Program License Agreement is accepted: a signed `Debug-iphoneos` development client exists with an iOS Team Provisioning Profile. Install still fails because Shuhei’s iPhone is locked, so the developer disk image cannot mount. Simulator was not used.

## Environment

| Item | Observed value |
| --- | --- |
| Checkout | `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step7-device-verification-20260906172837` |
| Branch / commit at start | `agent/r1-step7-device-verification-20260906172837` / `6657af6` |
| Device | Shuhei’s iPhone, iPhone 14 Pro (`iPhone15,2`), iOS 26.6.2 (23G90), UDID `00008120-001A2DE83A3B401E`, CoreDevice `60CDD5CA-0DAA-50FA-B0A2-268D29F8A1FF` |
| Device connection | USB (`xcdevice` available). `devicectl` tunnel acquired. Developer Mode enabled. `passcodeRequired=true`, `unlockedSinceBoot=true`. DDI mount: `kAMDMobileImageMounterDeviceLocked`. |
| App on device | Install of `com.cacheandbuffer.walkdog` did not complete. Signed local binary exists: `DerivedData/mobile-dreejpeqhkesltafkqlqrmoxohjv/Build/Products/Debug-iphoneos/mobile.app` with `embedded.mobileprovision` named `iOS Team Provisioning Profile: *`. |
| API URL | `EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000` in `apps/mobile/.env` |
| Compose | `GET http://127.0.0.1:3000/health` 200 `{"status":"ok"}`; `GET http://192.168.68.64:3000/health` 200 `{"status":"ok"}`. api, worker, postgres (healthy), elasticmq, dynamodb up. |
| AWS SSO | `amazon/aws-cli sts get-caller-identity --profile walk-dog` failed: SSO session expired. Device-code login started (`https://d-9567554c74.awsapps.com/start/#/device`, code `NQLF-CCCW`) and was not completed. OTP was not requested. |
| Signing | Team `CY4LJR5KMM`. Generic `iphoneos` `xcodebuild` with `-allowProvisioningUpdates` exited 0. PLA and missing-profile errors did not recur. |

## Commands

```sh
docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sts get-caller-identity --profile walk-dog
curl --fail http://127.0.0.1:3000/health
curl --fail http://192.168.68.64:3000/health
xcrun xctrace list devices
xcrun devicectl list devices
xcrun xcdevice list
xcrun devicectl device info lockState --device 00008120-001A2DE83A3B401E
# apps/mobile:
# EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo run:ios --device 00008120-001A2DE83A3B401E -p 8082
xcodebuild -workspace ios/mobile.xcworkspace -scheme mobile -configuration Debug \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=CY4LJR5KMM CODE_SIGN_STYLE=Automatic
xcrun devicectl device install app --device 00008120-001A2DE83A3B401E \
  /Users/matsuokashuhei/Library/Developer/Xcode/DerivedData/mobile-dreejpeqhkesltafkqlqrmoxohjv/Build/Products/Debug-iphoneos/mobile.app
```

`npx expo run:ios` selected the physical iPhone, then `xcodebuild` exited 70:

```text
Timed out waiting for all destinations matching the provided destination specifier to become available
{ platform:iOS, arch:arm64, id:00008120-001A2DE83A3B401E, name:Shuhei’s iPhone,
  error:The developer disk image could not be mounted on this device. }
```

`devicectl device install app` failed with the same DDI error, underlying `kAMDMobileImageMounterDeviceLocked`.

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

The iPhone is locked. CoreDevice can pair over USB, but mounting the developer disk image requires an unlocked device, so the development client cannot be installed or launched.

PLA is resolved. A signed `com.cacheandbuffer.walkdog` `iphoneos` build is already on this Mac.

**Human step:** unlock Shuhei’s iPhone (passcode or Face ID) while it stays USB-connected, leave it on the Home Screen with Auto-Lock off or a long Auto-Lock, then retry Task 4 from this worktree:

```sh
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo run:ios --device 00008120-001A2DE83A3B401E -p 8082
```

Also run `aws sso login --profile walk-dog` (or `docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sso login --profile walk-dog`) before any Cognito Verify. OTP was not reached this run.
