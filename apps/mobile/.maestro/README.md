# Mobile Maestro E2E (Sign Up)

## Prerequisites

1. Local API on port 3000 with Cognito + PostgreSQL (see prior Sign Up session continuation).
2. `apps/mobile/.env` with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`.
3. Mailosaur server id, API key, and a Mailosaur inbox address.
4. That Mailosaur address verified in SES (sandbox):

```bash
aws sso login --profile walk-dog
aws sesv2 create-email-identity --email-identity "$MAILOSAUR_EMAIL" --region ap-northeast-1 --profile walk-dog
# Open the SES verification link delivered to Mailosaur, then:
aws sesv2 get-email-identity --email-identity "$MAILOSAUR_EMAIL" --region ap-northeast-1 --profile walk-dog --query VerificationStatus
```

5. iOS Simulator + app running (`npx expo run:ios` or a build with bundle id `com.cacheandbuffer.walkdog`).
6. Maestro CLI (`~/.maestro/bin/maestro`).

## Run

```bash
export MAILOSAUR_API_KEY=...
export MAILOSAUR_SERVER_ID=...
export MAILOSAUR_EMAIL=...@...mailosaur.net

maestro test .maestro/sign-up-invalid-email.yaml
maestro test .maestro/sign-up-success.yaml -e MAILOSAUR_EMAIL="$MAILOSAUR_EMAIL" -e MAILOSAUR_API_KEY="$MAILOSAUR_API_KEY" -e MAILOSAUR_SERVER_ID="$MAILOSAUR_SERVER_ID"
# After a successful sign-up (tokens in Secure Store), with app still installed:
maestro test .maestro/cold-start-authenticated.yaml
```
