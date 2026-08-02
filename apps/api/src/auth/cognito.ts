import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminGetUserCommand,
  InitiateAuthCommand,
  type SignUpCommandOutput,
  type ConfirmSignUpCommandOutput,
  type AdminGetUserCommandOutput,
  type InitiateAuthCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'

export type CognitoConfig = {
  region: string
  userPoolId: string
  clientId: string
}

export function createCognitoClient(config: CognitoConfig) {
  const client = new CognitoIdentityProviderClient({ region: config.region })

  async function signUp(email: string): Promise<SignUpCommandOutput> {
    return client.send(new SignUpCommand({
      ClientId: config.clientId,
      Username: email,
      UserAttributes: [{ Name: 'email', Value: email }],
    }))
  }

  async function confirmSignUp(
    email: string,
    code: string,
    session?: string,
  ): Promise<ConfirmSignUpCommandOutput> {
    return client.send(new ConfirmSignUpCommand({
      ClientId: config.clientId,
      Username: email,
      ConfirmationCode: code,
      Session: session,
    }))
  }

  async function adminGetUser(email: string): Promise<AdminGetUserCommandOutput> {
    return client.send(new AdminGetUserCommand({
      UserPoolId: config.userPoolId,
      Username: email,
    }))
  }

  async function initiateAuth(
    email: string,
    session?: string,
  ): Promise<InitiateAuthCommandOutput> {
    return client.send(new InitiateAuthCommand({
      ClientId: config.clientId,
      AuthFlow: 'USER_AUTH',
      AuthParameters: {
        USERNAME: email,
        PREFERRED_CHALLENGE: 'EMAIL_OTP',
      },
      Session: session,
    }))
  }

  return { client, signUp, confirmSignUp, adminGetUser, initiateAuth }
}
