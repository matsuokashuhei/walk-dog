# Defensive-code re-review

- Branch: `agent/r1-step1-sign-up-mobile-20260803005130` (PR #33)
- Model: Codex `gpt-5.6-sol`

## Scope kept after user direction

Custom Email Sender OTP delivery was **restored** to the pre-optimization shape (single `index.handler`, CloudWatch `{ type:"cognito.otp", email, code }` for local E2E). SSM / `index.local` split was abandoned per user: do not optimize Custom Email Sender further in this session.

Mobile defensive fixes remain:
- Sign Up refuses navigation when `username` / `session` are missing
- Verify splits invalid-route vs `VerifyForm` with required params
- `api.ts` throws on invalid JSON (no silent `null` substitute)

## Decision (Codex, mobile wiring)

APPROVED for Sign Up / Verify / API client defensive-code remediation.

Custom Email Sender plaintext CloudWatch OTP logging remains an accepted local E2E trade-off for this session (not re-litigated).
