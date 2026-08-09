# Mobile Maestro E2E (Sign Up)

## Prerequisites

1. Local API on port 3000 with Cognito + PostgreSQL.
2. `apps/mobile/.env` with `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`.
3. Cognito CustomEmailSender Lambda deployed (`walkdog-local-custom-email-sender`) so OTP is decrypted and logged to CloudWatch.
4. `E2E_EMAIL` set to an SES-verified recipient (sandbox). OTP is read from CloudWatch, not the inbox.
5. AWS credentials (`AWS_PROFILE=walk-dog`) that can read the Lambda log group (`CloudWatchLogsReadOnlyAccess` or equivalent).
6. iOS Simulator + app with bundle id `com.cacheandbuffer.walkdog`.
7. Codex Build iOS Apps plugin (Maestro is not the gate).
8. Node dependency for the OTP poller: `@aws-sdk/client-cloudwatch-logs` in `apps/mobile`.

Default log group: `/aws/lambda/walkdog-local-custom-email-sender` (override with `COGNITO_OTP_LOG_GROUP`).

## Apply Custom Email Sender (local)

```bash
cd infra/aws/resources/lambda/custom_email_sender && npm install --omit=dev
aws sso login --profile walk-dog
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
