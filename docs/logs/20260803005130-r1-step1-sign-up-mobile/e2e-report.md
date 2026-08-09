# Sign Up Mobile iOS Simulator E2E report

## Status

passed

## Evidence

| Scenario | UI | API | DB | Result |
| --- | --- | --- | --- | --- |
| Invalid email | Entering `invalid-email` and submitting presents `auth-error` with `サインアップに失敗しました。再試行してください。`; `sign-up-submit` provides retry. | At 2026-08-09T06:59:50Z, `POST /v1/auth/sign-up` returned HTTP 400 with `{ "code": "INVALID_INPUT", "message": "有効なメールアドレスを入力してください。", "requestId": "ef5f43a4-1cb2-4a68-aeaa-72d319e7af1b", "retryable": false }`. | The invalid input creates no owner. | passed |
| Sign Up → OTP → Verify → home | On iPhone 17 Pro `A858B985-59B6-4699-A9AE-2C69CA06C2CA`, `matzuokashuhei@gmail.com` reached `verify-root`; verification with the CloudWatch OTP then reached `home-root`. | The OTP was read from `/aws/lambda/walkdog-local-custom-email-sender` as a `cognito.otp` event. | The prior successful Verify evidence recorded HTTP 200 at 2026-08-09T06:47:44Z and the matching owner row `019fe547-03dc-75bb-9172-61a03aa65b78` for Cognito subject `c714caf8-90a1-7007-2ae7-8b3cc872c009`. | passed |
| Cold start with stored tokens | With Metro confirmed running at `http://127.0.0.1:8081`, `stop_app_sim` then `launch_app_sim` on the same simulator reached `home-root` at 2026-08-09T06:59:40Z. The resulting UI exposed `home-root`, not `sign-up-email`. | Metro `/status` returned `packager-status:running` immediately before the stop-and-relaunch sequence. | The stored authenticated session restored the Home UI after process relaunch. | passed |

## Findings

- Invalid-email API validation returns the shared generic contract `{ code: "INVALID_INPUT", message: "入力内容を確認してください。", requestId, retryable: false }` from a field-agnostic `defaultHook`. Field-specific email copy is owned by Sign Up client pre-submit.
- A prior Verify 500 resulted from `DATABASE_URL` resolving to `localhost` inside the API container. The API now connects through `postgres:5432`.

## Execution notes

- Maestro was not used.
- The OTP poller path is `apps/mobile/scripts/e2e/fetch-cognito-otp.mjs`.
- The cold-start gate used Build iOS Apps / XcodeBuildMCP on simulator `A858B985-59B6-4699-A9AE-2C69CA06C2CA` and bundle `com.cacheandbuffer.walkdog`.
