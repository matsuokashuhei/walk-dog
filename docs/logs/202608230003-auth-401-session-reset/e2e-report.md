# iOS E2E result

## Authentication expiry

An iPhone 16 Pro simulator (iOS 18.3) ran the SDK 57.0.15 development client against the local API at `http://127.0.0.1:3000`.

The stored access token requested `GET /v1/owner`. The API returned `401 UNAUTHENTICATED`, the client cleared the session, and the Sign In screen became available.

![Sign In after authentication expiry](screenshots/ios-auth-expired-sign-in.png)

## Commands

```sh
npx expo install --check
npx expo-doctor
npx expo prebuild --clean
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000 npx expo run:ios --device 'iPhone 16 Pro' --port 8082
curl --include http://127.0.0.1:3000/v1/owner
```

`expo install --check` reported compatible dependencies, `expo-doctor` completed 21 of 21 checks, and the API returned `401` with `code: "UNAUTHENTICATED"`.
