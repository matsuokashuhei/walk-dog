# Codex E2E brief — R1 Step 1 Sign Up Mobile (Build iOS Apps + B2)

Worktree:

`/Users/matsuokashuhei/Development/walk-dog/.worktrees/agent/r1-step1-sign-up-mobile-20260803005130`

## Goal

Use the **Build iOS Apps** plugin (`build-ios-apps@openai-curated`) to drive the Expo mobile app on the iOS Simulator and verify Sign Up against the **real local API + Cognito**. Do **not** use Maestro as the gate.

OTP retrieval is **Custom Email Sender** (not Custom Message `{####}`):
- Lambda: `walkdog-local-custom-email-sender`
- CloudWatch log group: `/aws/lambda/walkdog-local-custom-email-sender`
- Structured log: `{ "type":"cognito.otp", "email", "code" }` with **plaintext** OTP after KMS decrypt
- Helper: `apps/mobile/scripts/e2e/fetch-cognito-otp.mjs`

## Required scenarios

1. Invalid email on Sign Up → visible `auth-error` (testID) and retry still available
2. Sign Up with SES-verified `E2E_EMAIL` → Verify → poll CloudWatch for OTP → enter code → `home-root`
3. Cold start / relaunch with stored tokens → `home-root`

Use accessibility / testIDs:
- `sign-up-root`, `sign-up-email`, `sign-up-submit`, `auth-error`
- `verify-root`, `verify-code`, `verify-submit`
- `home-root`

## Known env

- Bundle id: `com.cacheandbuffer.walkdog`
- API: `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000` (ensure API listening)
- Cognito pool `ap-northeast-1_JtAcxAaub` / client `43upvfsbiucgg4662phjvm8am8`
- Postgres: `postgresql://walk_dog:password@localhost:5432/walk_dog_dev`
- AWS profile: `walk-dog`
- Suggested E2E_EMAIL: `matzuokashuhei@gmail.com` (or other SES-verified address)

## Steps

1. Enable/use Build iOS Apps plugin skills (simulator build, launch, UI automation).
2. Ensure Simulator booted; build and launch the mobile app (`npx expo run:ios` or equivalent).
3. Ensure local API is up with Cognito env.
4. Run the three scenarios; for OTP use CloudWatch poller / AWS CLI FilterLogEvents.
5. Overwrite `docs/logs/20260803005130-r1-step1-sign-up-mobile/e2e-report.md`

## Deliverable

Report `status: passed | failed | blocked` with commands, scenario table, evidence (screenshots paths OK), blockers, harness fixes. Reply with only the report path.
