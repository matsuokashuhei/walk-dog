# Sign Up Mobile iOS Simulator E2E report

## Status

passed

## Commands run

```sh
curl --include --fail --silent http://localhost:3000/health
(cd apps/mobile && E2E_EMAIL=matzuokashuhei@gmail.com AWS_PROFILE=walk-dog COGNITO_OTP_LOG_GROUP=/aws/lambda/walkdog-local-custom-email-sender COGNITO_OTP_WAIT_MS=60000 node scripts/e2e/fetch-cognito-otp.mjs)
docker run --rm -v /Users/matsuokashuhei/.aws:/root/.aws amazon/aws-cli --profile walk-dog logs filter-log-events --log-group-name /aws/lambda/walkdog-local-custom-email-sender --start-time "$(date -v-5M +%s)000" --filter-pattern '"cognito.otp"' --region ap-northeast-1 --output json
```

Build iOS Apps / XcodeBuildMCP commands:

```text
session_show_defaults
build_run_sim
type_text(sign-up-email, invalid-email)
tap(sign-up-submit)
wait_for_ui(auth-error)
type_text(sign-up-email, matzuokashuhei@gmail.com)
tap(sign-up-submit)
wait_for_ui(verify-root)
type_text(verify-code, OTP from Custom Email Sender)
tap(verify-submit)
wait_for_ui(home-root)
stop_app_sim
launch_app_sim
wait_for_ui(home-root)
```

## Environment evidence

- The real local API health endpoint returned HTTP 200 with `{ "status": "ok" }`.
- XcodeBuildMCP built, installed, and launched `com.cacheandbuffer.walkdog` on iPhone 16 Pro (`E79A77D3-51F8-45D8-B052-15463D52A4F8`). Build log: `~/Library/Developer/XcodeBuildMCP/workspaces/r1-step1-sign-up-mobile-20260803005130-5bf3ed2665cf/logs/build_run_sim_2026-08-09T04-53-07-356Z_pid47008_e65239f4.log`.
- `/aws/lambda/walkdog-local-custom-email-sender` emitted the matching structured `cognito.otp` event for `matzuokashuhei@gmail.com` with a six-digit plaintext code and trigger `CustomEmailSender_SignUp`.

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Invalid email on Sign Up | passed | XcodeBuildMCP entered `invalid-email`, tapped `sign-up-submit`, and observed `auth-error`. The snapshot then exposed an enabled `sign-up-submit` with label `再試行`. |
| Sign Up → Custom Email Sender OTP → Verify | passed | XcodeBuildMCP submitted `matzuokashuhei@gmail.com` and observed `verify-root`, `verify-code`, and `verify-submit`. The Custom Email Sender CloudWatch event supplied a six-digit OTP, which was entered into `verify-code`; submitting it reached `home-root`. |
| Cold start with stored tokens | passed | XcodeBuildMCP stopped and launched `com.cacheandbuffer.walkdog`; the relaunch observed `home-root`, confirming the stored-token restore path. |

## Blockers

None.

## Harness fixes

- The Custom Email Sender + KMS deployment supplies the plaintext OTP in the `cognito.otp` structured CloudWatch event. The accessible auth button labels and testIDs remain available to Build iOS Apps / XcodeBuildMCP. Maestro was not used.
