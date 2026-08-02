# Mobile Maestro E2E (Sign Up)

## Prerequisites

1. Local API on port 3000 with Cognito + PostgreSQL.
2. `apps/mobile/.env` with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`.
3. Cognito Custom Message Lambda deployed for local (`walkdog-local-cognito-custom-message`) so OTP is logged to CloudWatch.
4. `E2E_EMAIL` set to an SES-verified recipient (sandbox). OTP is read from CloudWatch, not the inbox.
5. AWS credentials (`AWS_PROFILE=walk-dog`) that can read the Lambda log group.
6. iOS Simulator + app with bundle id `com.cacheandbuffer.walkdog`.
7. Maestro CLI (`~/.maestro/bin/maestro`).
8. Node dependency for the OTP poller: from `apps/mobile`, ensure `@aws-sdk/client-cloudwatch-logs` is available (install if missing).

## Apply Custom Message Lambda (local)

```bash
aws sso login --profile walk-dog
cd infra/aws/envs/local
# follow infra/README.md terraform docker workflow, then terraform apply
```

## Run

```bash
export AWS_PROFILE=walk-dog
export AWS_REGION=ap-northeast-1
export E2E_EMAIL='verified-address@example.com'

maestro test .maestro/sign-up-invalid-email.yaml
maestro test .maestro/sign-up-success.yaml -e E2E_EMAIL="$E2E_EMAIL"
# After a successful sign-up (tokens in Secure Store):
maestro test .maestro/cold-start-authenticated.yaml
```
