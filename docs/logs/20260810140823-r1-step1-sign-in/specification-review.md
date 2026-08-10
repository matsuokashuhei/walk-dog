# Specification review

- status: ready
- Purpose: R1 Step 1 Sign In across API and Mobile
- Active release: R1
- next permitted action: implementation

## Sources

1. `docs/development/staged-development.md`
   - R1 is active and Account provides Sign Up, Sign In, OTP verification, Owner display name, and Sign Out.
   - The Account slice requires PostgreSQL Owner data, Cognito API token verification, mobile auth state, and the mobile API client.
2. `docs/specs/external-specification.html`
   - Authentication API defines `POST /auth/sign-in` and `POST /auth/sign-in/verify`.
   - AC-AUTH-02 provides expired-code recovery with a replacement OTP; AC-AUTH-03 provides authenticated entry for an existing Owner.
3. `docs/specs/mobile-journey-wireflow.html`
   - AUTH-01 provides email entry, legal links, and Sign Up choice.
   - AUTH-03 provides eight-digit Sign In OTP verification and recovery.
4. `docs/logs/20260803005130-r1-step1-sign-up-mobile/transcript.md`
   - Mobile API client, Secure Store auth state, Sign Up, Verify, local API, Cognito, and PostgreSQL E2E are delivered.
5. Current implementation
   - `apps/api/src/auth/cognito.ts` provides `initiateAuth` and `respondToAuthChallenge`.
   - `apps/api/src/routes/auth.ts` provides the existing Owner response and shared error contract.
   - `apps/mobile/src/app/(auth)/verify.tsx` provides the verified-token persistence path.

## Current deliverables

1. Sign In starts a Cognito EMAIL_OTP challenge and returns the username, challenge session, and delivery data.
2. Sign In verification accepts an eight-digit OTP and returns access, ID, and refresh tokens with the existing Owner.
3. The mobile Sign In route accepts an email address, opens the existing public legal documents, and links to Sign Up.
4. The shared Verify route preserves Sign Up verification and provides Sign In confirmation and OTP replacement.
5. iOS E2E records Sign In, OTP, retry, and authenticated screenshots in the session report.

## Decisions

- Plan-level: Sign In uses dedicated `POST /v1/auth/sign-in` and `POST /v1/auth/sign-in/verify` endpoints. The user approved the public interface.
- Implementation-local: `/verify` receives a mobile-only flow parameter and selects the matching API endpoint, OTP length, restart destination, and retry action.
- Plan-level: Sign In opens the existing Terms and Privacy documents at `https://cacheandbuffer.com/`. The user provided and approved the URL.
- Implementation-local: Cursor Agent model `cursor-grok-4.5-high` performs a read-only final code review and returns `APPROVED` before publishing.

## Verification conditions

- API contract tests cover success, invalid input, authentication failure, invalid OTP, expired OTP, and rate limiting.
- Sign In E2E uses an existing confirmed Owner and the local API, Cognito, PostgreSQL, and CloudWatch OTP record.
- E2E report contains saved screenshots for the Sign In, OTP, OTP replacement, and authenticated states.
- Cursor Grok High reviews the final diff against repository `AGENTS.md` and required skills until it returns `APPROVED`.

## Gaps checked

- Release boundaries: the Account slice owns Sign In; Dog and Walk behavior remain in later R1 slices.
- Specification preconditions: Mobile auth state and API client are delivered by the Sign Up slice; Sign In uses them without adding an outbound queue, location, or AWS data services.
- Implementation evidence: Cognito EMAIL_OTP methods and Owner response paths exist; Sign In routes and mobile screen remain to be added.
- Plan table: Account requires the existing Owner schema and the delivered auth/client foundations; no migration is needed for Sign In.
