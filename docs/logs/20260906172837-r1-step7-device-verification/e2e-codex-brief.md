# Codex E2E brief — R1 Step 7 Device Verification (Physical iPhone)

Worktree (must use this checkout):

`/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step7-device-verification-20260906172837`

Session artifacts:

`docs/logs/20260906172837-r1-step7-device-verification/`

## Goal

Drive the Expo **physical iPhone** development client against the **real local Compose stack** on the same LAN (API + worker + ElasticMQ + DynamoDB Local + Postgres + Cognito). Prove Active Walk reconcile on launch, Foreground, and tab focus; Background TrackPoint continuity; Active disappearance → Failed; and automatic TrackPoint resend after network recovery. Do **not** use Maestro. **Simulator-only runs do not satisfy this brief.**

Follow `.agents/skills/recording-ios-e2e-evidence/SKILL.md`.

OTP helper: `apps/mobile/scripts/e2e/fetch-cognito-otp.sh`  
AWS profile: `walk-dog`  
Before any Cognito Verify: `aws sts get-caller-identity --profile walk-dog` (SSO login if needed).

## Product contract under test

- **Launch restore (AC-WALK-03):** When `GET /v1/walks/active` returns a recording walk, restarting the app and showing Walk restores Recording (path reload, location task reattached).
- **Foreground reconcile:** On AppState `active`, re-fetch Active Walk. Active exists → keep Recording. Active missing → Failed.
- **Tab reconcile:** Walk tab focus runs the same Active Walk check as Foreground.
- **Background location (AC-WALK-04):** With foreground + background location granted, Recording continues sampling every 10 s and enqueueing TrackPoints while backgrounded; when the network is up, points reach `POST /v1/walks/:walkId/track-points`.
- **Active disappearance (AC-WALK-06):** If reconcile finds no Active Walk (`GET /v1/walks/active` → **204**), show Failed (**散歩を継続できません**) with **Ready に戻る**.
- **Network recovery:** While Recording, temporary API unreachability keeps unsent points in the on-device queue. After API recovery, points auto-resend with no retry cap; UI stays Recording.

Specs: `device-verification-spec-mockups.html`, `design.md` in this session directory.

## Environment (physical iPhone + LAN Compose)

| Item | Value |
| --- | --- |
| Compose file | `apps/compose.yml` |
| Mac health | `curl --fail http://127.0.0.1:3000/health` → **200** |
| Device health | `curl --fail http://<mac-lan-ip>:3000/health` from Mac (same URL the phone uses) → **200** |
| API URL on device | `EXPO_PUBLIC_API_BASE_URL=http://<mac-lan-ip>:3000` in `apps/mobile/.env` |
| LAN IP | e.g. `ipconfig getifaddr en0` |
| Bundle id | `com.cacheandbuffer.walkdog` |
| Device | Physical iPhone only (same Wi‑Fi as Mac; allow inbound TCP 3000 if macOS firewall prompts) |
| Native rebuild | Required after any `EXPO_PUBLIC_*` change: `npx expo run:ios --device` |
| Metro | Worktree `apps/mobile`; rebuild/run from this worktree so reconcile code is live |

Start Compose from repo root or `apps/`:

```bash
docker compose -f apps/compose.yml up --build -d
```

See `apps/mobile/README.md` → **Physical iPhone (same LAN as Compose)** for the full LAN URL procedure (Task 2).

## Shared preflight (before scenarios)

1. `aws sts get-caller-identity --profile walk-dog` (SSO login if needed).
2. Compose up; Mac **and** LAN health **200**. Worker running.
3. `apps/mobile/.env` uses `http://<mac-lan-ip>:3000`, not `127.0.0.1`. Rebuild on device if changed.
4. Sign In via Cognito OTP if needed. Dogs tab lists ≥1 Dog (e.g. `Mugi`); register if empty.
5. Grant **使用中** and **常に** location on the physical device.
6. Walk tab → select Dog → **Start** → Recording (**散歩中**, Finish available).

Use real movement outdoors or repeated location changes so TrackPoints can land (10 s sampling interval).

## Required scenarios

### A) Launch restore — AC-WALK-03

1. From shared preflight, confirm Recording and at least one accepted TrackPoint (**201**) if practical (optional but helps path evidence).
2. Force-quit the app (swipe away from app switcher).
3. Relaunch the development client and open the **Walk** tab.
4. Expect Recording restored: **散歩中**, map path visible, Finish available. API: `GET /v1/walks/active` **200** with the same `walkId`.

**Screenshot:** `screenshots/ios-walk-reconcile-restart-recording.png`  
Capture Recording after relaunch with path or Recording chrome visible.

### B) Foreground reconcile — Recording retained

1. With the same Recording walk (continue from A or start a fresh Recording).
2. Send the app to Background (Home / switch apps) for ≥15 s.
3. Return to the app (Foreground / AppState `active`).
4. Expect Recording retained: **散歩中**, Finish still available. Path may reload from on-device store. API: `GET /v1/walks/active` **200**.

**Screenshot:** `screenshots/ios-walk-reconcile-foreground-recording.png`  
Capture Recording immediately after Foreground return.

### C) Tab reconcile — Dogs → Walk

1. With Recording active (continue from B or fresh Recording).
2. Switch to the **Dogs** tab.
3. Switch back to the **Walk** tab.
4. Expect reconcile to keep Recording: **散歩中**, Finish available. API: `GET /v1/walks/active` **200**.

**Screenshot:** `screenshots/ios-walk-reconcile-tab-recording.png`  
Capture Recording after returning to the Walk tab.

### D) Background location — AC-WALK-04

1. Start or continue a Recording walk with location permissions granted.
2. Note the on-screen path length or last visible segment (optional baseline).
3. Background the app for ≥30 s while moving (walk/drive) so new samples can occur.
4. Return to Foreground on Walk.
5. Expect Recording with an **extended path** (new segment beyond pre-background). API: additional `POST /v1/walks/:walkId/track-points` **201** entries while backgrounded (check API logs, Postgres, or DynamoDB Local as available).

**Screenshot:** `screenshots/ios-walk-background-trackpoint.png`  
Capture **after** returning to Foreground, showing Recording and a visibly extended route.

### E) Active disappearance → Failed — AC-WALK-06

1. Start a **fresh** Recording walk (do not reuse a walk needed for F).
2. While the phone still shows Recording, remove Active Walk on the server using **either**:
   - `DELETE /v1/walks/:walkId` from a separate client (curl with the same owner token), **or**
   - Mark that walk failed on the API side so `GET /v1/walks/active` returns **204**.
3. Trigger reconcile: send app to Background then Foreground **or** Dogs → Walk tab switch.
4. Expect Failed: **散歩を継続できません**, **Ready に戻る** available. API: `GET /v1/walks/active` **204**.

**Screenshot:** `screenshots/ios-walk-reconcile-active-missing-failed.png`  
Capture the Failed screen with title and **Ready に戻る** readable.

### F) Network recovery — automatic resend

1. Start a **fresh** Recording walk.
2. On the Mac, stop only the **API** container while Recording continues on device:

   ```bash
   docker compose -f apps/compose.yml stop api
   ```

3. Keep the app in Recording (Foreground or Background). Move or wait ≥20 s so at least one location sample is taken while API is down (points accumulate in `walk-outbound-queue.json`).
4. Restart API:

   ```bash
   docker compose -f apps/compose.yml start api
   ```

   Wait until `http://<mac-lan-ip>:3000/health` → **200**.
5. Return to or stay on Walk Recording. Wait for flush/resend (next sample or automatic queue drain).
6. Expect UI still **Recording** (**散歩中**, Finish available). Verify **evidence that queued points were sent** — e.g. API access logs showing new `POST .../track-points` **201** after restart, or increased accepted point count in Postgres/DynamoDB for that `walkId`. State in `e2e-report.md` which evidence you used.

**Screenshot:** `screenshots/ios-walk-network-recovery-recording.png`  
Capture Recording **after** API recovery, with path/map visible. Report must also document the send evidence (not only the PNG).

## Scenario order

Run **A → B → C → D** on one Recording when possible. Use **fresh walks** for **E** and **F** (E destroys Active; F stops API).

## Out of scope

- VPS / remote API on physical device (deferred)
- Maestro
- Simulator-only acceptance
- New HTTP endpoints
- Finish / Completed / Event / Walk Detail flows (covered in prior steps)
- Native rebuild unless required for `EXPO_PUBLIC_*` or crash recovery

## Steps (executor checklist)

1. SSO check before OTP.
2. LAN Compose health on Mac and via `<mac-lan-ip>`.
3. Run Metro / dev client from **this worktree**.
4. Execute scenarios A–F; capture all six PNGs under `docs/logs/20260906172837-r1-step7-device-verification/screenshots/`.
5. Write `docs/logs/20260906172837-r1-step7-device-verification/e2e-report.md` (overwrite).
6. If behavior diverges from contract, apply minimal mobile fixes (Task 4), re-run failed scenarios only, then commit evidence.

## Deliverable (`e2e-report.md`)

- `status: passed | failed | blocked`
- Environment: iPhone model, iOS version, LAN API URL, Compose health, SSO
- Commands run (compose, API stop/start, DELETE if used)
- Scenario table A–F: pass/fail, UI observation, API evidence
- For **F**: explicit sentence on how queued points reaching the API was verified
- Markdown image attachments for all six PNGs
- Blockers if any

Commit `e2e-report.md` + `screenshots/*.png` (+ any gap-fix code) on branch `agent/r1-step7-device-verification-20260906172837`.

Reply with only the report path when done.
