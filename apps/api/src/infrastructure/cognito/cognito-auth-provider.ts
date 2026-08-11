import {
  InvalidParameterException,
  LimitExceededException,
  NotAuthorizedException,
  TooManyRequestsException,
  UsernameExistsException,
  UserNotConfirmedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider'
import type {
  AuthProvider,
  ResendSignUpCodeProviderResult,
  SignUpProviderResult,
  StartSignInProviderResult,
} from '../../modules/auth/provider.js'
import type { CodeDelivery } from '../../modules/auth/types.js'
import type { CognitoClient } from './client.js'

function codeDeliveryFromDetails(
  details: { Destination?: string; AttributeName?: string } | undefined,
): CodeDelivery | null {
  if (!details) {
    return null
  }
  return {
    destination: details.Destination ?? '',
    attribute: details.AttributeName ?? '',
  }
}

function isRateLimited(error: unknown): boolean {
  return error instanceof TooManyRequestsException || error instanceof LimitExceededException
}

async function signUp(cognitoClient: CognitoClient, email: string): Promise<SignUpProviderResult> {
  try {
    const output = await cognitoClient.signUp(email)
    return {
      outcome: 'signed-up',
      session: output.Session ?? null,
      codeDelivery: codeDeliveryFromDetails(output.CodeDeliveryDetails),
    }
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      return { outcome: 'username-exists' }
    }
    if (error instanceof InvalidParameterException) {
      return { outcome: 'invalid-input' }
    }
    if (isRateLimited(error)) {
      return { outcome: 'rate-limited' }
    }
    throw error
  }
}

async function resendSignUpCode(
  cognitoClient: CognitoClient,
  email: string,
): Promise<ResendSignUpCodeProviderResult> {
  try {
    const output = await cognitoClient.resendConfirmationCode(email)
    return {
      outcome: 'code-sent',
      codeDelivery: codeDeliveryFromDetails(output.CodeDeliveryDetails),
    }
  } catch (error) {
    if (error instanceof InvalidParameterException) {
      return { outcome: 'already-confirmed' }
    }
    if (isRateLimited(error)) {
      return { outcome: 'rate-limited' }
    }
    throw error
  }
}

async function startSignIn(
  cognitoClient: CognitoClient,
  email: string,
  session?: string,
): Promise<StartSignInProviderResult> {
  try {
    const output = await cognitoClient.initiateAuth(email, session)
    if (output.ChallengeName !== 'EMAIL_OTP' || !output.Session) {
      return { outcome: 'incomplete-challenge' }
    }
    return {
      outcome: 'challenge',
      session: output.Session,
      codeDelivery: {
        destination: output.ChallengeParameters?.CODE_DELIVERY_DESTINATION ?? '',
        attribute: 'email',
      },
    }
  } catch (error) {
    if (
      error instanceof UserNotFoundException
      || error instanceof UserNotConfirmedException
      || error instanceof NotAuthorizedException
    ) {
      return { outcome: 'authentication-failed' }
    }
    if (isRateLimited(error)) {
      return { outcome: 'rate-limited' }
    }
    throw error
  }
}

export function createCognitoAuthProvider(cognitoClient: CognitoClient): AuthProvider {
  return {
    signUp: (email) => signUp(cognitoClient, email),
    resendSignUpCode: (email) => resendSignUpCode(cognitoClient, email),
    startSignIn: (email, session) => startSignIn(cognitoClient, email, session),
  }
}
