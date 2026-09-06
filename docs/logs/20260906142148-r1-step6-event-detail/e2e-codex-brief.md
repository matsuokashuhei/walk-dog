# Codex E2E brief — R1 Step 6 Event + Detail (iOS Simulator)

Worktree (must use this checkout):

`/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step6-event-detail-20260906142148`

Session artifacts:

`docs/logs/20260906142148-r1-step6-event-detail/`

## Goal

Drive the Expo iOS Simulator against the **real local Compose stack** (API + worker + ElasticMQ + DynamoDB Local + Postgres + Cognito). Capture Event success, Event retryable failure, and Walk Detail. Do **not** use Maestro.

Follow `.agents/skills/recording-ios-e2e-evidence/SKILL.md`.

OTP helper: `apps/mobile/scripts/e2e/fetch-cognito-otp.sh`  
AWS profile: `walk-dog`  
Before any Cognito Verify: `aws sts get-caller-identity --profile walk-dog` (SSO login if needed). SSO was confirmed working at brief time via `amazon/aws-cli` container.

## Product contract under test

- Recording shows local distance/pace and Participant Event chips (`pee`/`poop`/`sniff`/`greet`).
- Event POST uses mobile `eventId`; failure shows **「記録に失敗しました」** (`testID=walk-event-error`) with Retry (`testID=walk-event-retry`); same payload on retry.
- Finish persists DynamoDB path distance; Completed shows distance (`testID=walk-completed-distance`) and **Walk Detail を見る** (`testID=walk-completed-detail`).
- Detail (`testID=walk-detail`) shows events or **「記録された Event はありません」** (`testID=walk-detail-events-empty`).

Specs: `event-api-spec.html`, `event-spec-mockups.html`, `design.md` in this session directory.

## Required scenarios

### A) Success — Event → Finish → Completed distance → Detail with Event

1. Ensure Compose is up from **this worktree** (`apps/compose.yml`). Rebuild API/worker so Event + distance code is live:  
   `docker compose -f apps/compose.yml up -d --build api worker`  
   `GET http://127.0.0.1:3000/health` → **200**. Worker running. Postgres migrated (includes `walk_events` / `distance_meters`).
2. Sign In (Cognito OTP) if needed. Dogs list ≥1 Dog (e.g. `Mugi`); register if empty.
3. Grant location + location-always. Set simulator location (e.g. `35.681236,139.767125`).
4. Walk tab → select Dog → Start → Recording.
5. Wait ≥10s / move location so at least one TrackPoint **201** lands (distance can become >0).
6. Tap Pee for the selected Dog: `testID=walk-event-pee-<dogId>` (dogId from UI/API).
7. Expect Event accepted (error banner gone). API: `POST .../events` **201** (or **200** replay).
8. Tap `終了する` (`testID=walk-finish`).
9. Expect Completed: `testID=walk-completed`. Distance visible on `walk-completed-distance` (integer meters or km UI — readable non-idle metrics).
10. Tap `walk-completed-detail` → Detail `walk-detail` shows at least one event row (`walk-detail-event-<eventId>`).

**Screenshot:** `screenshots/ios-walk-event-detail-success.png`  
Capture on Walk Detail with Event list visible (or Completed with distance + Detail button if Detail map fails — prefer Detail with Event).

### B) Retryable failure — API stopped → Event error message

1. Start a fresh Recording (same setup as A steps 1–5) so GPS is available for Event lat/lng.
2. **Stop the API** container so Event POST cannot succeed (`docker compose ... stop api`). Keep Metro/sim running.
3. Tap an Event chip (`walk-event-pee-<dogId>`).
4. Expect Recording retained with `testID=walk-event-error` showing exactly **`記録に失敗しました`** and `testID=walk-event-retry` available.

**Screenshot:** `screenshots/ios-walk-event-retry.png`  
Capture Recording with the Event error message readable.

### C) Recovery — Restart API → Retry Event → Finish → Detail

1. From scenario B’s Recording state.
2. Start API again (`docker compose ... start api`). Wait until `/health` **200**.
3. Tap `walk-event-retry`.
4. Expect error banner cleared (Event accepted **201** or **200**).
5. Finish the walk (`walk-finish`) → Completed → open Detail.
6. Detail shows the Event (or empty only if Event never landed — then fail the scenario).

**Screenshot:** `screenshots/ios-walk-event-retry-recovered.png`  
Capture Detail with Event after successful Retry (or Completed after recovery if Detail navigation flakes — prefer Detail).

## Out of scope

- History list offset paging (R2)
- Photo
- Native rebuild unless the app crashes
- Maestro

## Known env

- Bundle id: `com.cacheandbuffer.walkdog`
- API: `http://127.0.0.1:3000` (`EXPO_PUBLIC_API_BASE_URL`)
- Prefer simulator: iPhone 17 Pro `C01CDE0B-DAF2-4466-9C9B-41E63A0CBEDE` (already Booted)
- Metro: worktree `apps/mobile`, port `8081`
- Use Build iOS Apps / XcodeBuildMCP / `agent-device` / `simctl` as available — same tooling as prior R1 Walk E2E sessions
- `.env.local` may exist under worktree `apps/` with local defaults; do not commit it

## Steps

1. SSO check before OTP.
2. Health 200; worker running for A/C; **API rebuilt from this worktree**.
3. Run Metro against **this worktree**.
4. Execute A → B → C in order (B/C share one Recording when possible).
5. Write `docs/logs/20260906142148-r1-step6-event-detail/e2e-report.md`.
6. Ensure PNGs exist under `docs/logs/20260906142148-r1-step6-event-detail/screenshots/`.
7. Commit `e2e-report.md` + `screenshots/*.png` (+ brief if useful) on branch `agent/r1-step6-event-detail-20260906142148`. Do **not** push or open a PR (parent will publish after verifying PNGs).

## Deliverable

`e2e-report.md` with:

- `status: passed | failed | blocked`
- environment (simulator UDID, Metro, API health, SSO)
- commands run
- scenario table: UI / API evidence
- Markdown image attachments for all three PNGs
- blockers if any

Reply with only the report path when done.
