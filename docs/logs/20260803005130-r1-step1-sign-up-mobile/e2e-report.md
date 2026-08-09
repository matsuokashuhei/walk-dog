# Sign Up Mobile iOS Simulator E2E report

## Status

blocked

## Commands run

```sh
open -a Simulator
docker run --rm -v /Users/matsuokashuhei/.aws:/root/.aws amazon/aws-cli --profile walk-dog sts get-caller-identity --output json
docker compose -f apps/compose.yml up -d postgres
(cd apps/api && npm ci)
(cd apps/api && AWS_PROFILE=walk-dog AWS_REGION=ap-northeast-1 COGNITO_USER_POOL_ID=ap-northeast-1_JtAcxAaub COGNITO_CLIENT_ID=43upvfsbiucgg4662phjvm8am8 DATABASE_URL=postgresql://walk_dog:password@localhost:5432/walk_dog_dev ENVIRONMENT=development RELEASE=local npm run dev)
curl --include --fail --silent http://localhost:3000/health
(cd apps/mobile && npx expo run:ios --device E79A77D3-51F8-45D8-B052-15463D52A4F8)
```

## Environment evidence

- Build iOS Apps / XcodeBuildMCP booted iPhone 16 Pro (`E79A77D3-51F8-45D8-B052-15463D52A4F8`).
- XcodeBuildMCP built, installed, and launched `com.cacheandbuffer.walkdog` successfully. Runtime log: `~/Library/Developer/XcodeBuildMCP/workspaces/r1-step1-sign-up-mobile-20260803005130-5bf3ed2665cf/logs/com.cacheandbuffer.walkdog_2026-08-09T04-30-29-172Z_helperpid59284_ownerpid47008_1649393a.log`.
- The local API health endpoint returned HTTP 200 with `{ "status": "ok" }`.
- The `walk-dog` AWS SSO profile returned a caller identity, so Cognito and CloudWatch credentials were available.

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Invalid email on Sign Up | blocked | `sign-up-root` and `sign-up-email` appeared in the XcodeBuildMCP UI snapshot. After entering an invalid email, the snapshot exposed no target for `sign-up-submit`; Tab and Space did not submit the form. Consequently `auth-error` and the retry operation could not be observed. |
| SES-verified sign up → CloudWatch OTP → Verify | blocked | The submit operation could not be invoked through the required Build iOS Apps UI automation, so no Cognito sign-up request or OTP was issued and `verify-root` / `home-root` could not be reached. |
| Cold start with stored tokens | blocked | The authenticated-session prerequisite could not be established because the verification operation was unreachable. |

## Blockers

- The XcodeBuildMCP accessibility snapshot exposes the email input (`sign-up-email`) but does not expose the `Pressable` with testID `sign-up-submit` as a tap target. The visible Continue control has no accessible button target or identifier in the snapshot.
- This prevents the required Build iOS Apps plugin from submitting the form. Maestro was not used.

## Harness fixes

- Expose each actionable `Pressable` as an accessibility button with its stable testID so XcodeBuildMCP can tap `sign-up-submit`, `verify-submit`, and `verify-restart`; then rerun the three scenarios and poll `/aws/lambda/walkdog-local-custom-message` after sign-up.
