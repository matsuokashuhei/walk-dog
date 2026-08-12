# Specification review

- status: awaiting-confirmation
- Purpose: R1 Step 1 Sign Out across API and Mobile
- Active release: R1
- next permitted action: await plan-level confirmation for mobile Sign Out placement and Active Walk discard scope

## Sources

1. `docs/development/staged-development.md`
   - 進捗状況 / R1 縦切りと未完了 R0 前提 / R1: 散歩記録の縦切り
   - R1 is active. Account provides Sign Up, Sign In, OTP, Owner display name, and Sign Out.
   - Account requires PostgreSQL owners schema, Cognito API token verification, mobile auth state, and mobile API client.
2. `docs/specs/external-specification.html`
   - 01.6 Settings: Sign Out on `/settings`
   - 01.5 Active Walk mid Sign Out: confirmation; on accept, discard Active Walk as Failed then Sign Out
   - 02.2 Auth API: `POST /auth/sign-out`, Access Token, request `{ discardActiveWalk? }`, success `204 No Content`
   - 02.7 Sign Out: Active Walk confirmation; `discardActiveWalk=true` discards then signs out
   - AC-AUTH-05: Active Walk present, discard accepted → Failed discard, Sign In
3. `docs/specs/mobile-journey-wireflow.html`
   - ME-03 `/settings`: Sign Out success path; Active Walk blocks Sign Out on failure path
4. `docs/specs/2026-07-26-hono-api-r0-design.md`
   - Authenticated endpoints verify Cognito access tokens with `aws-jwt-verify`
   - OpenAPI `BearerAuth`; auth middleware before protected handlers
   - Missing/invalid token → HTTP 401, `UNAUTHENTICATED`
5. Prior logs
   - `docs/logs/20260803005130-r1-step1-sign-up-mobile/specification-review.md`: Sign Out deferred as remaining Account capability
   - `docs/logs/20260810140823-r1-step1-sign-in/specification-review.md`: Sign In delivered; Account still lists Sign Out
6. Current implementation
   - `apps/api/src/modules/auth/routes/index.ts`: Sign Up / Sign In routes only; no Sign Out route
   - `apps/api/src/modules/auth/provider.ts`: no Sign Out provider method
   - No Cognito access-token verifier middleware in `apps/api/src`
   - `apps/mobile/src/lib/auth.tsx`: `clearSession` exists; no Sign Out API call
   - `apps/mobile/src/app/(app)/index.tsx`: signed-in home placeholder; no `/settings` route

## Current release deliverables (proposed pending confirmation)

1. Just-in-time R0: Cognito access-token verification middleware and OpenAPI `BearerAuth` for protected routes.
2. API: `POST /v1/auth/sign-out` accepts a verified access token, optional `discardActiveWalk`, invalidates the Cognito session, returns `204`.
3. Mobile: authenticated owner can Sign Out, clear local tokens, and return to Sign In.
4. Verification: API contract tests for success and 401; mobile/iOS evidence for Sign Out to Sign In.

## Decisions

- Plan-level (awaiting confirmation): Mobile Sign Out entry point for this session.
  - Option A: minimal `/settings` with Sign Out only (Preferences / email change remain R3).
  - Option B: Sign Out control on the current authenticated home placeholder until Settings exists.
- Deferred release decision (awaiting confirmation): Active Walk discard path (`discardActiveWalk`, confirmation dialog, AC-AUTH-05) belongs to R1 Step 3 Active Walk. This session accepts the optional request field and signs out when no Active Walk exists.
- Implementation-local (after confirmation): Cognito GlobalSignOut / RevokeToken adapter details, route module layout under feature-first auth, E2E screenshot set.
- Outside staged plan: none identified.
- Note: external auth error list includes `AUTHENTICATION_REQUIRED`; R0 design and middleware skill define the auth gate as `UNAUTHENTICATED`. Sign Out 401 uses the R0 gate contract.

## Verification conditions

- OpenAPI and route contract tests cover authenticated Sign Out success (`204`) and missing/invalid access token (`401` `UNAUTHENTICATED`).
- Mobile clears Secure Store tokens and shows the Sign In route after Sign Out.
- iOS evidence records authenticated Sign Out and the post-Sign-Out Sign In state.

## Gaps checked

- Release boundaries: Account owns Sign Out; Dog / Active Walk / Preferences remain later steps or R3. Active Walk discard is proposed as deferred to Step 3 pending confirmation.
- Specification preconditions: Cognito API token verification is required and unfinished → included as just-in-time R0 for this session. Mobile auth state and API client exist from Sign Up / Sign In.
- Implementation evidence: Sign Out route, token verifier, Settings screen, and Sign Out UI are absent; `clearSession` helper exists.
- Plan table: Account row marks Cognito API token verification as 必須; delivered claim for verifier is false until this session implements it.
- Source tension recorded: `AUTHENTICATION_REQUIRED` (external) vs `UNAUTHENTICATED` (R0 design / middleware skill) for the auth gate; gate follows R0.
