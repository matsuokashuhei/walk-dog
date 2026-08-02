# Implementation plan: R1 Step 1 Sign Up Mobile

## Task 1 — Mobile API client + Auth state + provisional home

1. Install `expo-secure-store` via `npx expo install`.
2. Add `EXPO_PUBLIC_API_BASE_URL` (default for iOS Simulator: `http://127.0.0.1:3000`).
3. Create `src/lib/api.ts`: JSON `fetch` wrapper, parse `{ code, message, requestId, retryable }` errors, optional Bearer token.
4. Create `src/lib/auth.tsx`: Secure Store for access/id/refresh tokens; AuthProvider with bootstrapping, `setSession`, `clearSession`, `useAuth`.
5. Update root `_layout.tsx` to wrap AuthProvider and branch unauthenticated vs authenticated stacks.
6. Add authenticated provisional home screen (placeholder until Dogs List / Step 2).
7. Verify: TypeScript check; app boots to Sign Up when logged out and home when tokens exist (manual smoke until Task 3).

## Task 2 — Sign Up + Verify screens

1. Add `src/app/auth/_layout.tsx` Stack.
2. Add Sign Up screen: email → `POST /v1/auth/sign-up` → navigate Verify with username/session; Loading / Error / Retry.
3. Add Verify screen: OTP → `POST /v1/auth/verify` → `setSession` → authenticated home; Loading / Error / Retry.
4. Wire testIDs for Maestro (`sign-up-email`, `sign-up-submit`, `verify-code`, `verify-submit`, `auth-error`, `home-root`).
5. Verify: TypeScript check; screens render and call API client.

## Task 3 — Cognito OTP log (B2) + Maestro E2E

1. Add local Cognito Custom Message Lambda that logs OTP (email + code) as structured JSON; attach to user pool.
2. Replace Mailosaur Maestro OTP script with CloudWatch log poller.
3. Update Maestro README / flows for SES-verified recipient + log-based OTP.
4. Ask Codex to install/run Maestro E2E against real API and evaluate the report.
5. **Execution note:** Cursor agent does not run Maestro directly; Codex runs E2E. Mailosaur abandoned.

## Task 4 — Crit + publish PR

1. Sync session artifacts.
2. Crit session records (exclude transcript); address comments.
3. Push branch and open PR against `main` with session log.
