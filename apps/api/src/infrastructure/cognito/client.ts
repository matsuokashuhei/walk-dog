import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminGetUserCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'

export type CognitoConfig = {
  region: string
  userPoolId: string
  clientId: string
}

export type CognitoSender = {
  send: CognitoIdentityProviderClient['send']
  destroy: () => void
}

export type CognitoClient = ReturnType<typeof createCognitoClient>

export function createCognitoClient(
  config: CognitoConfig,
  sender: CognitoSender = new CognitoIdentityProviderClient({ region: config.region }),
) {
  return {
    client: sender,
    destroy() {
      sender.destroy()
    },
    signUp(email: string) {
      return sender.send(new SignUpCommand({
        ClientId: config.clientId, Username: email,
        UserAttributes: [{ Name: 'email', Value: email }],
      }))
    },
    confirmSignUp(email: string, code: string, session?: string) {
      return sender.send(new ConfirmSignUpCommand({
        ClientId: config.clientId, Username: email,
        ConfirmationCode: code, Session: session,
      }))
    },
    resendConfirmationCode(email: string) {
      return sender.send(new ResendConfirmationCodeCommand({
        ClientId: config.clientId, Username: email,
      }))
    },
    adminGetUser(email: string) {
      return sender.send(new AdminGetUserCommand({
        UserPoolId: config.userPoolId, Username: email,
      }))
    },
    initiateAuth(email: string, session?: string) {
      return sender.send(new InitiateAuthCommand({
        ClientId: config.clientId,
        AuthFlow: 'USER_AUTH',
        AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
        Session: session,
      }))
    },
    respondToAuthChallenge(email: string, session: string, code: string) {
      return sender.send(new RespondToAuthChallengeCommand({
        ClientId: config.clientId,
        ChallengeName: 'EMAIL_OTP',
        ChallengeResponses: { USERNAME: email, EMAIL_OTP_CODE: code },
        Session: session,
      }))
    },
  }
}
