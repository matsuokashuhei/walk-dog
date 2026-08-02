# Codex E2E brief — R1 Step 1 Sign Up Mobile

You are running inside the session worktree:

`/Users/matsuokashuhei/Development/walk-dog/.worktrees/agent/r1-step1-sign-up-mobile-20260803005130`

## Goal

Execute the real-API Maestro E2E gate for Sign Up Mobile (option B + Mailosaur OTP B1 + SES sandbox recipient verify S2). Do not implement product features unless required to make E2E runnable. Fix only E2E harness / env / flaky test issues.

## Required scenarios

1. `apps/mobile/.maestro/sign-up-invalid-email.yaml` — invalid email shows `auth-error` and retry remains available
2. `apps/mobile/.maestro/sign-up-success.yaml` — Mailosaur email → OTP via Mailosaur API → authenticated `home-root`
3. `apps/mobile/.maestro/cold-start-authenticated.yaml` — after success, relaunch shows `home-root`

Follow `apps/mobile/.maestro/README.md`.

## Environment known from prior session

- Cognito User Pool: `ap-northeast-1_JtAcxAaub`
- Cognito Client ID: `43upvfsbiucgg4662phjvm8am8`
- Postgres: `postgresql://walk_dog:password@localhost:5432/walk_dog_dev`
- API port: 3000
- AWS profile: `walk-dog` (use aws-login skill / `aws sso login --profile walk-dog` if needed)
- Mobile bundle id: `com.cacheandbuffer.walkdog`
- Mobile API base URL: `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`

## Mailosaur / SES

Need `MAILOSAUR_API_KEY`, `MAILOSAUR_SERVER_ID`, `MAILOSAUR_EMAIL`.
If missing from the environment or local secrets, stop and report blocker clearly — do not invent credentials.
With credentials: SES-verify the Mailosaur address while staying in sandbox (`aws sesv2 create-email-identity` + confirm via Mailosaur inbox).

## Deliverable

Write a single Markdown report to:

`docs/logs/20260803005130-r1-step1-sign-up-mobile/e2e-report.md`

Include:

- status: `passed` | `failed` | `blocked`
- commands run
- scenario results (pass/fail + evidence)
- blockers / missing secrets
- any harness fixes you made (paths)

Then reply with only that file path.
