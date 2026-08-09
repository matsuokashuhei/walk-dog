# Codex E2E brief — R1 Step 1 Sign Up Mobile (UI + API + DB)

Worktree:

`/Users/matsuokashuhei/Development/walk-dog/.worktrees/agent/r1-step1-sign-up-mobile-20260803005130`

## Goal

Use the **Build iOS Apps** plugin (`build-ios-apps@openai-curated` / XcodeBuildMCP) to drive the Expo app on iOS Simulator against the **real local API + Cognito + Postgres**. Do **not** use Maestro.

Also verify **API responses** and **DB side effects**, not only UI.

OTP helper: `apps/mobile/scripts/e2e/fetch-cognito-otp.mjs`  
CloudWatch log group: `/aws/lambda/walkdog-local-custom-email-sender`  
Structured log: `{ "type":"cognito.otp", "email", "code" }` (plaintext)

## Required scenarios

### 1) Invalid email (UI + API)

- UI: enter `invalid-email`, tap `sign-up-submit`, observe `auth-error`, retry available.
- API: `POST http://127.0.0.1:3000/v1/auth/sign-up` with `{ "email":"invalid-email" }` returns **400** and body with `code`, `message`, `requestId`, `retryable`.
- DB: no new `owners` row is required for this path (sign-up failure before verify).

### 2) Sign Up → OTP → Verify → home (UI + API + DB)

Use SES-verified `E2E_EMAIL=matzuokashuhei@gmail.com` (reset Cognito user first if it already exists).

- UI: Sign Up → `verify-root` → poll OTP → enter code → `home-root`.
- API (curl, same email / resulting username+session+code as the app flow, or parallel capture):
  - `POST /v1/auth/sign-up` → **200** with non-empty `username` and `session`.
  - After OTP: `POST /v1/auth/verify` → **200** with `accessToken`, `idToken`, `refreshToken`, and `owner.ownerId`.
- DB: after successful verify, Postgres has an `owners` row whose `cognito_subject` equals the ID token `sub`, and `owner_id` matches `owner.ownerId` from the verify response.
  - Connection: `postgresql://walk_dog:password@localhost:5432/walk_dog_dev` (or `DATABASE_URL` from `apps/.env.local`).
  - Example: `docker run --rm --network host -e PGPASSWORD=password postgres:16 psql -h 127.0.0.1 -U walk_dog -d walk_dog_dev -c "SELECT owner_id, cognito_subject, display_name FROM owners ORDER BY created_at DESC LIMIT 5;"`

### 3) Cold start with stored tokens (UI)

- Stop and relaunch the app; observe `home-root`.

## Known env

- Bundle id: `com.cacheandbuffer.walkdog`
- API: `http://127.0.0.1:3000` (`EXPO_PUBLIC_API_BASE_URL`)
- Cognito pool `ap-northeast-1_JtAcxAaub` / client `43upvfsbiucgg4662phjvm8am8`
- AWS profile: `walk-dog`
- OTP poller path changed: `apps/mobile/scripts/e2e/fetch-cognito-otp.mjs` (no `.maestro/`)

## Steps

1. Ensure API health `GET /health` → 200.
2. If needed, delete existing Cognito user for `E2E_EMAIL` so Sign Up can create a fresh challenge.
3. Build/run app on Simulator via Build iOS Apps.
4. Run scenarios 1–3 with UI + API + DB evidence.
5. Overwrite `docs/logs/20260803005130-r1-step1-sign-up-mobile/e2e-report.md`

## Deliverable

Report `status: passed | failed | blocked` with:
- commands run
- scenario table including **UI / API / DB** columns or evidence per layer
- blockers if any

Reply with only the report path.
