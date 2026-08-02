import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminGetUserCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider'

export type CognitoConfig = {
  region: string
  userPoolId: string
  clientId: string
}

export type CognitoClient = ReturnType<typeof createCognitoClient>

export function createCognitoClient(config: CognitoConfig) {
  const client = new CognitoIdentityProviderClient({ region: config.region })

  return {
    client,
    signUp(email: string) {
      return client.send(new SignUpCommand({
        ClientId: config.clientId, Username: email,
        UserAttributes: [{ Name: 'email', Value: email }],
      }))
    },
    confirmSignUp(email: string, code: string, session?: string) {
      return client.send(new ConfirmSignUpCommand({
        ClientId: config.clientId, Username: email,
        ConfirmationCode: code, Session: session,
      }))
    },
    adminGetUser(email: string) {
      return client.send(new AdminGetUserCommand({
        UserPoolId: config.userPoolId, Username: email,
      }))
    },
    initiateAuth(email: string, session?: string) {
      return client.send(new InitiateAuthCommand({
        ClientId: config.clientId,
        AuthFlow: 'USER_AUTH',
        AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
        Session: session,
      }))
    },
    respondToAuthChallenge(email: string, session: string, code: string) {
      return client.send(new RespondToAuthChallengeCommand({
        ClientId: config.clientId,
        ChallengeName: 'EMAIL_OTP',
        ChallengeResponses: { USERNAME: email, EMAIL_OTP_CODE: code },
        Session: session,
      }))
    },
  }
}
