---
name: aws-cognito
description: Work with AWS Cognito User Pools for email-OTP authentication. Covers sign-up, verification, SES email delivery, and sandbox restrictions.
---

# AWS Cognito

This project uses Cognito with email-OTP authentication (`EMAIL_OTP` auth factor). Cognito sends OTP codes via Amazon SES.

## Cognito configuration

- User Pool: `walkdog-<env>-user`
- App Client: `walkdog-<env>-app`
- Auth flow: `ALLOW_USER_AUTH` with `EMAIL_OTP` as the first auth factor
- Sign-in policy: `EMAIL_OTP` and `PASSWORD`
- Email sending: `DEVELOPER` account via SES

## Cognito API flow

The sign-up and verification flow uses Cognito sessions:

1. `SignUp(ClientId, Username=email, UserAttributes=[email])` → returns `UserSub`, `Session`, `CodeDeliveryDetails`
2. `ConfirmSignUp(ClientId, Username=email, ConfirmationCode=code, Session=session)` → returns a new `Session` (or empty)
3. `InitiateAuth(ClientId, AuthFlow=USER_AUTH, AuthParameters={USERNAME=email, PREFERRED_CHALLENGE=EMAIL_OTP}, Session=session)` → returns `AuthenticationResult` with tokens

The session from `SignUp` enables a single-OTP flow: the user confirms sign-up and gets tokens without a second OTP.

## AWS SDK methods

When writing Cognito client code, use the TypeScript AWS SDK v3:

```ts
import { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, AdminGetUserCommand, RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider'
```

Key methods:
- `SignUpCommand`: create an unconfirmed user, returns session
- `ConfirmSignUpCommand`: confirm with OTP code, returns optional session
- `InitiateAuthCommand`: start auth flow (USER_AUTH), returns tokens with valid session
- `AdminGetUserCommand`: check user status (UNCONFIRMED / CONFIRMED)
- `RespondToAuthChallengeCommand`: complete EMAIL_OTP challenge during sign-in

## SES email delivery

Cognito uses SES to send OTP emails. The `DEVELOPER` sending account requires:

- SES domain identity verified (e.g. `local.walkdog.cacheandbuffer.com`)
- SES identity verification status: `Success`

### SES sandbox

When `ProductionAccessEnabled` can be `false` (sandbox mode). In sandbox:
- SES can only send to **verified email addresses** or verified domains
- To send to a new address, add it as an SES verified identity:

```bash
aws sesv2 create-email-identity --email-identity <address> --region ap-northeast-1 --profile walk-dog
```

- The recipient must click the verification link sent by SES
- Check verification status:

```bash
aws sesv2 get-email-identity --email-identity <address> --region ap-northeast-1 --profile walk-dog --query VerificationStatus
```

### Testing with email delivery

When OTP emails do not arrive:
1. Verify the SES identity for the sender domain: `get-identity-verification-attributes`
2. Verify the recipient email is in the SES verified identities list (if sandbox)
3. Check SES sending quota: `sesv2 get-account` → `SendingEnabled` and `ProductionAccessEnabled`
4. Send a test email directly via SES to confirm the delivery chain works
5. Check that Cognito user status is `UNCONFIRMED` via `admin-get-user`
