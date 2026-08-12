# Specification review

- status: awaiting-confirmation
- Purpose: R1 Step 1 Sign Out across API and Mobile
- Active release: R1
- next permitted action: await confirmation of mobile Settings placement; Active Walk Sign Out behavior is confirmed

## Sources

1. `docs/development/staged-development.md`
   - 進捗状況 / R1 縦切りと未完了 R0 前提 / R1: 散歩記録の縦切り
   - R1 is active. Account provides Sign Up, Sign In, OTP, Owner display name, and Sign Out.
   - Account requires PostgreSQL owners schema, Cognito API token verification, mobile auth state, and mobile API client.
2. `docs/specs/external-specification.html`
   - 01.6 Settings: Sign Out on `/settings`
   - 01.5 / 02.7 / AC-AUTH-05: Active Walk mid Sign Out uses confirmation; accepted discard ends as Failed then Sign In
   - 02.2 listed optional `discardActiveWalk`; this session replaces that with always-Failed Active Walk on Sign Out
3. `docs/specs/mobile-journey-wireflow.html`
   - ME-03 `/settings`: Sign Out success path; Active Walk blocks unconfirmed Sign Out
4. `docs/specs/2026-07-26-hono-api-r0-design.md`
   - Cognito access-token verification, `BearerAuth`, HTTP 401 `UNAUTHENTICATED`
5. Session specification
   - `docs/logs/20260812175057-r1-step1-sign-out/sign-out-specification.md`
   - `docs/logs/20260812175057-r1-step1-sign-out/sign-out-spec-mockups.html`
6. Current implementation
   - Auth routes cover Sign Up / Sign In only
   - No access-token verifier middleware
   - Mobile has `clearSession` and no Settings / Sign Out UI

## Current release deliverables

1. Just-in-time R0: Cognito access-token verification and OpenAPI `BearerAuth`.
2. API: `POST /v1/auth/sign-out` with verified access token; empty body; Active Walk present → Failed then Cognito sign-out; success `204`.
3. Mobile Settings (`/settings`): legal links, Sign Out, Active Walk confirmation dialog, loading and error states, success transition to Sign In.
4. Verification: API contracts for `204` and `401`; mobile evidence for no-Active-Walk Sign Out and confirm → Sign In when Active Walk is present.

## Decisions

- Plan-level (confirmed 2026-08-12): Active Walk during Sign Out is always Failed after the owner confirms. The client shows a confirmation dialog when Active Walk exists. The API does not accept `discardActiveWalk`; Sign Out itself performs Failed when an Active Walk exists.
- Plan-level (awaiting confirmation): Mobile entry is minimal `/settings` with Sign Out and legal links. Preferences and Email Change remain R3.
- Implementation-local (after Settings confirmation): Cognito sign-out adapter, feature-first auth route module, E2E screenshots.
- Deferred: Active Walk persistence and Failed transition implementation land with the Active Walk slice when that data exists; the Sign Out contract already defines the behavior.
- Note: auth gate uses `UNAUTHENTICATED` per R0 design.

## Verification conditions

- `POST /v1/auth/sign-out` returns `204` for a valid access token.
- Missing or invalid access token returns `401` `UNAUTHENTICATED`.
- Mobile clears Secure Store tokens and shows Sign In after success.
- When Active Walk is present, Sign Out tap shows confirmation; cancel keeps session and walk; confirm signs out and treats Active Walk as Failed.
- iOS evidence covers idle Settings, confirm (when Active Walk is available), and post-Sign-Out Sign In.

## Gaps checked

- Release boundaries: Account owns Sign Out UI/API. Active Walk Failed transition is part of the Sign Out contract and is realized when Active Walk data exists.
- Specification preconditions: Cognito API token verification is required and unfinished → JIT R0 in this session.
- Implementation evidence: Sign Out route, verifier, Settings, and confirm dialog are absent.
- Plan table: Account requires Cognito API token verification; verifier not delivered until this session.
- Confirmed product override: external optional `discardActiveWalk` is replaced by always-Failed Active Walk on confirmed Sign Out.
