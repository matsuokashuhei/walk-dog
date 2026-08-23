# iOS E2E result

## Authentication expiry

An iPhone 16 Pro simulator (iOS 18.3) ran the SDK 57.0.15 development client against the local API at `http://127.0.0.1:3000`.

The development build restored a test-only expired session with an access token, ID token, and refresh token. The Simulator requested `GET /v1/owner` with `Authorization: Bearer expired-access-token`; the test API returned `401 UNAUTHENTICATED` with request ID `e2e-auth-expired-401`. The app displayed the Sign In screen after that response. The test-only fixture was removed before committing.

![Sign In after authentication expiry](screenshots/ios-auth-expired-sign-in.png)

The complete API request and response record is saved in [api-log.ndjson](api-log.ndjson).

## Commands

```sh
npx expo install --check
npx expo-doctor
npx expo prebuild --clean
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000 npx expo run:ios --device 'iPhone 16 Pro' --port 8082
curl --include --header 'Authorization: Bearer expired-token' http://127.0.0.1:3000/v1/owner
```

`expo install --check` reported compatible dependencies, `expo-doctor` completed 21 of 21 checks, and the API returned `401` with `code: "UNAUTHENTICATED"` for the invalid Bearer token.
