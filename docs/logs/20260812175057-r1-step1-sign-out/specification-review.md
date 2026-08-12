# Specification review

- status: ready
- Purpose: R1 Step 1 Sign Out across API and Mobile
- Active release: R1
- next permitted action: crit

## Sources

1. `docs/development/staged-development.md`
   - R1 Account includes Sign Out
   - Sign Out confirms when Active Walk exists, then Failed + Cognito sign-out
   - `POST /v1/auth/sign-out` returns 204; Failed Active Walk when present
2. `docs/specs/external-specification.html` and `docs/specs/mobile-journey-wireflow.html`
   - Settings hosts Sign Out; Active Walk uses confirmation before discard
3. `docs/specs/2026-07-26-hono-api-r0-design.md`
   - Cognito access-token verification, `BearerAuth`, `401` `UNAUTHENTICATED`
4. Session specification
   - `docs/logs/20260812175057-r1-step1-sign-out/sign-out-specification.md`
   - `docs/logs/20260812175057-r1-step1-sign-out/sign-out-spec-mockups.html`
5. Current implementation
   - Sign Up / Sign In only; no token verifier; mobile `clearSession` exists; no Settings route

## Current release deliverables

1. JIT R0 Cognito access-token verification and OpenAPI `BearerAuth`
2. `POST /v1/auth/sign-out` → fail Active Walk when present → Cognito sign-out → `204`
3. Mobile `/settings` with legal links, Sign Out, Active Walk confirmation, loading/error, success → Sign In
4. Contract tests and iOS evidence for the no-Active-Walk path

## Decisions

- Plan-level (confirmed): Active Walk on confirmed Sign Out is always Failed. Confirmation dialog when Active Walk exists. Request body allows `{}` or omission only.
- Plan-level (confirmed): Mobile entry is `/settings` with Sign Out and legal links. R3 adds Preferences and Email Change to Settings.
- Implementation-local: `ActiveWalkCommands.failIfPresent` port with a current no-Active-Walk implementation; Walk slice replaces it later.
- Note: auth gate uses `UNAUTHENTICATED` per R0 design.

## Verification conditions

- Valid access token → `204`
- Missing/invalid access token → `401` `UNAUTHENTICATED`
- Mobile clears tokens and shows Sign In after success
- Active Walk present → confirm; cancel keeps session/walk; confirm signs out with Failed Active Walk
- iOS evidence for Settings idle and post-Sign-Out Sign In

## Gaps checked

- Release boundaries: Account owns Sign Out. Active Walk Failed realization waits on Walk data; contract and port are fixed now.
- Preconditions: Cognito API token verification required and unfinished → JIT in this session.
- Implementation evidence: verifier, Sign Out route, Settings UI absent; `clearSession` present.
- Plan table: Account Cognito token verification cell remains required and becomes delivered by this session.
- Product override vs external optional `discardActiveWalk`: confirmed always-Failed behavior synced to staged plan.
