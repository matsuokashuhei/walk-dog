# Sign Up Mobile iOS Simulator E2E report

## Status

blocked

## Commands run

```sh
curl --include --fail --silent http://localhost:3000/health
docker run --rm -v /Users/matsuokashuhei/.aws:/root/.aws amazon/aws-cli --profile walk-dog logs filter-log-events --log-group-name /aws/lambda/walkdog-local-custom-message --start-time "$(date -v-10M +%s)000" --filter-pattern '"cognito.otp"' --region ap-northeast-1 --output json
```

Build iOS Apps / XcodeBuildMCP commands:

```text
session_show_defaults
build_run_sim
wait_for_ui(sign-up-root)
type_text(sign-up-email, invalid-email)
tap(sign-up-submit)
wait_for_ui(auth-error)
type_text(sign-up-email, matzuokashuhei@gmail.com)
tap(sign-up-submit)
wait_for_ui(verify-root)
```

## Environment evidence

- The real local API health endpoint returned HTTP 200 with `{ "status": "ok" }`.
- XcodeBuildMCP built, installed, and launched `com.cacheandbuffer.walkdog` on iPhone 16 Pro (`E79A77D3-51F8-45D8-B052-15463D52A4F8`). Build log: `~/Library/Developer/XcodeBuildMCP/workspaces/r1-step1-sign-up-mobile-20260803005130-5bf3ed2665cf/logs/build_run_sim_2026-08-09T04-35-34-743Z_pid47008_2856bc80.log`.
- The `walk-dog` AWS SSO profile accessed `/aws/lambda/walkdog-local-custom-message`.

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Invalid email on Sign Up | passed | XcodeBuildMCP entered `invalid-email`, tapped `sign-up-submit`, and observed `auth-error`. The snapshot then exposed `sign-up-submit` as an enabled button with label `再試行`. |
| SES-verified sign up → CloudWatch OTP → Verify | blocked | XcodeBuildMCP entered `matzuokashuhei@gmail.com`, tapped `sign-up-submit`, and observed `verify-root`, `verify-code`, and the accessible `verify-submit` target. CloudWatch emitted `{"type":"cognito.otp","trigger":"CustomMessage_SignUp","email":"matzuokashuhei@gmail.com","code":"{####}"}`. `{####}` is the Cognito message template token, not a one-time code accepted by `verify-code`, so `home-root` could not be reached. |
| Cold start with stored tokens | blocked | The sign-up verification flow could not produce stored tokens because CloudWatch supplied `{####}` rather than the OTP. The authenticated cold-start precondition was therefore not established. |

## Blockers

- The deployed `walkdog-local-custom-message` Lambda emits Cognito's code placeholder `{####}` in `cognito.otp.code`. The B2 helper requires the concrete OTP to submit `verify-code`.

## Harness fixes

- Update the B2 OTP source to provide the concrete verification code for the matching email, then rerun Verify and the stored-token cold-start scenario. The Sign Up, Verify, and restart controls are now accessible to Build iOS Apps / XcodeBuildMCP; Maestro was not used.
