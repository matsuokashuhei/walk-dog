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
4. Wire testIDs for UI automation (`sign-up-email`, `sign-up-submit`, `verify-code`, `verify-submit`, `auth-error`, `home-root`).
5. Verify: TypeScript check; screens render and call API client.

## Task 3 — Cognito OTP log (B2) + Codex Build iOS App E2E

1. Cognito **CustomEmailSender** Lambda + KMS (replaces Custom Message `{####}`): `walkdog-local-custom-email-sender`.
2. OTP poller `apps/mobile/scripts/e2e/fetch-cognito-otp.mjs` reads CloudWatch log group `/aws/lambda/walkdog-local-custom-email-sender` for plaintext `{ type:"cognito.otp", email, code }`.
3. Completion gate runner: **Codex Build iOS Apps plugin**.
4. Ask Codex to build/run `apps/mobile` on iOS Simulator and execute:
   - invalid email → `auth-error` + retry
   - Sign Up success → OTP from CloudWatch → home
   - cold start with stored tokens → home
5. Write `e2e-report.md` with passed/failed/blocked.

## Task 4 — Publish PR

1. Sync session artifacts.
2. Crit skipped by user direction.
3. Push branch and open PR against `main` with session log.
