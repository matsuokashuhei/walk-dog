# Codex E2E brief — R1 Step 5 Finish (iOS Simulator)

Worktree (must use this checkout — Finish wait / 503 message live here):

`/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step5-finish-20260906122123`

Session artifacts:

`docs/logs/20260906122123-r1-step5-finish/`

## Goal

Drive the Expo iOS Simulator against the **real local Compose stack** (API + worker + ElasticMQ + DynamoDB Local + Postgres + Cognito). Capture Finish success and Finish retryable-failure screenshots. Do **not** use Maestro.

Follow `.agents/skills/recording-ios-e2e-evidence/SKILL.md`.

OTP helper: `apps/mobile/scripts/e2e/fetch-cognito-otp.sh`  
AWS profile: `walk-dog`  
Before any Cognito Verify: `aws sts get-caller-identity --profile walk-dog` (SSO login if needed).

## Product contract under test

- Finish flushes the outbound TrackPoint queue, then `POST /v1/walks/:walkId/finish`.
- API waits up to **30s** until PostgreSQL-accepted TrackPoints exist in DynamoDB, then returns Completed (`distanceMeters` 0).
- TrackPoint **0件** skips the wait.
- Confirmation timeout / wait failure → **503** `SERVICE_UNAVAILABLE`, message **「終了処理を完了できませんでした。もう一度お試しください。」**, walk stays `recording`; UI keeps Recording and shows that message (`testID=walk-finish-error`).

Specs: `finish-api-spec.html`, `finish-spec-mockups.html`, `design.md` in this session directory.

## Required scenarios

### A) Success — Finish with TrackPoints → Completed

1. Ensure Compose is up (`apps/compose.yml` from worktree or `apps/`). `GET http://127.0.0.1:3000/health` → **200**. Worker must be running.
2. Sign In (Cognito OTP) if needed. Dogs should list at least one Dog (e.g. `Mugi`); register if empty.
3. Grant location + location-always. Set simulator location (e.g. `35.681236,139.767125`).
4. Walk tab → select Dog → Start → Recording.
5. Wait for at least one `POST /v1/walks/:walkId/track-points` **201** (move location ≥10s apart if needed so a sample lands).
6. Tap `終了する` (`testID=walk-finish`).
7. Expect Completed: `testID=walk-completed` shows `散歩が完了しました`, distance **0 m**, `Ready へ戻る` available.
8. API: `POST .../finish` **200**. Optionally confirm DynamoDB Local has the walk’s TrackPoint(s) (table `TrackPoints`, keys `walkId` + `recordedAt`).

**Screenshot:** `screenshots/ios-walk-finish-completed.png`  
Capture on the Completed screen with title and `0 m` visible.

### B) Retryable failure — worker stopped → 503 message → Recording retained

1. Start a fresh Recording walk with at least one accepted TrackPoint **201** (same setup as A steps 1–5).
2. **Stop the worker** container so confirmation cannot complete (e.g. `docker compose -f apps/compose.yml stop worker` from the compose project that owns the stack). Keep API up.
3. Tap `終了する`.
4. Expect Recording retained: `testID=walk-finish` still available; `testID=walk-finish-error` shows exactly  
   `終了処理を完了できませんでした。もう一度お試しください。`
5. API: `POST .../finish` **503** with `code=SERVICE_UNAVAILABLE`, `retryable=true`, same message. Walk remains `recording` (`GET /v1/walks/active` **200**).

**Screenshot:** `screenshots/ios-walk-finish-retry.png`  
Capture on Recording with the finish error message readable.

### C) Recovery — Restart worker → Retry Finish → Completed

1. From scenario B’s Recording state (same Idempotency-Key / same Finish retry).
2. Start worker again (`docker compose ... start worker`).
3. Tap `終了する` again (Retry).
4. Expect Completed (`walk-completed`, `0 m`).
5. API: `POST .../finish` **200** (or replay 200 if the first request already completed server-side after worker catch-up — either way UI must show Completed).

**Screenshot:** `screenshots/ios-walk-finish-retry-completed.png`  
Capture Completed after successful Retry.

## Out of scope

- Event / Walk Detail / distance from path
- Native rebuild unless the app crashes
- Maestro

## Known env

- Bundle id: `com.cacheandbuffer.walkdog`
- API: `http://127.0.0.1:3000` (`EXPO_PUBLIC_API_BASE_URL`)
- Prefer prior simulator if available: iPhone 17 Pro `C01CDE0B-DAF2-4466-9C9B-41E63A0CBEDE` (or another booted iPhone)
- Metro: worktree `apps/mobile`, typically port `8081`
- Use Build iOS Apps / XcodeBuildMCP / `agent-device` / `simctl` as available — same tooling as prior R1 Walk E2E sessions

## Steps

1. SSO check before OTP.
2. Health 200; worker running for A; compose from worktree branch code for API behavior.
3. Run Metro against **this worktree** so Finish 503 copy is present.
4. Execute A → B → C in order (B/C share one Recording when possible).
5. Write `docs/logs/20260906122123-r1-step5-finish/e2e-report.md` (overwrite).
6. Ensure PNGs exist under `docs/logs/20260906122123-r1-step5-finish/screenshots/`.

## Deliverable

`e2e-report.md` with:

- `status: passed | failed | blocked`
- environment (simulator UDID, Metro, API health, SSO)
- commands run
- scenario table: UI / API (/ DynamoDB for A) evidence
- Markdown image attachments for all three PNGs
- blockers if any

Also commit the new `e2e-report.md` + `screenshots/*.png` on branch `agent/r1-step5-finish-20260906122123` and push to origin (PR #93).

Reply with only the report path when done.
