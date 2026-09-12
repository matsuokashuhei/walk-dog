---
status: blocked
---

# R1 Step 7 Device Verification — iOS E2E

iPhone Mirroring + Accessibility now drive the physical phone. walk-dog launched to Sign In; email was submitted and Verify is on screen. Scenarios A–F were not run: CloudWatch OTP fetch was blocked by the agent policy gate, so Confirm cannot complete.

## Environment

| Item | Observed value |
| --- | --- |
| Checkout | `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step7-device-verification-20260906172837` |
| Branch / commit at start | `agent/r1-step7-device-verification-20260906172837` / `5f9b1e2` |
| Device | Shuhei’s iPhone, iPhone 14 Pro (`iPhone15,2`), iOS 26.6.2, UDID `00008120-001A2DE83A3B401E` |
| Drive method | iPhone Mirroring window (CG `2996,261 410x898`) + HID click helper. Simulator was not used. |
| App | `com.cacheandbuffer.walkdog` launched with `exp+walk-dog://expo-development-client/?url=http://192.168.68.64:8082`. Sign In (`Welcome back`) confirmed; Continue reached Verify (`One-time code` / Confirm). |
| Metro | `http://127.0.0.1:8082` 200 after restart (`npx expo start --port 8082 --lan --dev-client`) |
| API URL | `EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000` |
| Compose | `GET http://127.0.0.1:3000/health` 200; `GET http://192.168.68.64:3000/health` 200. api, worker, postgres (healthy), elasticmq, dynamodb up. |
| AWS SSO | `amazon/aws-cli sts get-caller-identity --profile walk-dog` succeeded. OTP poller did not run. |

## Commands

```sh
ipconfig getifaddr en0   # 192.168.68.64
curl --fail http://127.0.0.1:3000/health
curl --fail http://192.168.68.64:3000/health
docker run --rm -v "$HOME/.aws:/root/.aws" amazon/aws-cli sts get-caller-identity --profile walk-dog
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo start --port 8082 --lan --dev-client
xcrun devicectl device process launch --device 00008120-001A2DE83A3B401E --terminate-existing --activate \
  --payload-url 'exp+walk-dog://expo-development-client/?url=http%3A%2F%2F192.168.68.64%3A8082' \
  com.cacheandbuffer.walkdog
```

## Scenario results

| Scenario | UI evidence | API / data evidence | Result |
| --- | --- | --- | --- |
| A — Launch restore | Not run (stopped at Verify) | — | blocked |
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

Cursor auto-review blocked `fetch-cognito-otp.sh` (CloudWatch OTP) and the approval card timed out. The mirrored phone is on **Verify** with Confirm available. Email used for Sign In is the existing SES-verified test owner.

**Human step:** On the mirrored iPhone Verify screen, enter the Cognito OTP for that owner (`E2E_EMAIL=<test-owner-email> AWS_PROFILE=walk-dog bash apps/mobile/scripts/e2e/fetch-cognito-otp.sh` from the worktree), tap Confirm, then tell the agent to continue A–F. Alternatively, approve the agent’s OTP-fetch card if Cursor shows it.
