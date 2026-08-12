import {
  AliasExistsException,
  CodeMismatchException,
  ExpiredCodeException,
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
  VerifySignInProviderResult,
  VerifySignUpProviderResult,
} from '../../modules/auth/provider.js'
import type { Authentication, CodeDelivery } from '../../modules/auth/types.js'
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

function decodeIdTokenSubject(idToken: string): string | null {
  const payload = idToken.split('.')[1]
  if (!payload) {
    return null
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as { sub?: unknown }
  return typeof decoded.sub === 'string' ? decoded.sub : null
}

function authenticationFromResult(
  authResult: { AccessToken?: string; IdToken?: string; RefreshToken?: string } | undefined,
): Authentication | null {
  if (!authResult?.AccessToken || !authResult.IdToken || !authResult.RefreshToken) {
    return null
  }
  const subject = decodeIdTokenSubject(authResult.IdToken)
  if (subject === null) {
    return null
  }
  return {
    subject,
    accessToken: authResult.AccessToken,
    idToken: authResult.IdToken,
    refreshToken: authResult.RefreshToken,
  }
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

type VerifySharedFailure =
  | { outcome: 'code-expired' }
  | { outcome: 'invalid-code' }
  | { outcome: 'code-already-used' }
  | { outcome: 'rate-limited' }

function mapVerifyException(
  error: unknown,
  notAuthorizedOutcome: 'already-confirmed',
): VerifySharedFailure | { outcome: 'already-confirmed' } | null
function mapVerifyException(
  error: unknown,
  notAuthorizedOutcome: 'authentication-failed',
): VerifySharedFailure | { outcome: 'authentication-failed' } | null
function mapVerifyException(
  error: unknown,
  notAuthorizedOutcome: 'already-confirmed' | 'authentication-failed',
): VerifySharedFailure | { outcome: 'already-confirmed' } | { outcome: 'authentication-failed' } | null {
  if (error instanceof ExpiredCodeException) {
    return { outcome: 'code-expired' }
  }
  if (error instanceof CodeMismatchException) {
    return { outcome: 'invalid-code' }
  }
  if (error instanceof AliasExistsException) {
    return { outcome: 'code-already-used' }
  }
  if (error instanceof NotAuthorizedException) {
    return { outcome: notAuthorizedOutcome }
  }
  if (isRateLimited(error)) {
    return { outcome: 'rate-limited' }
  }
  return null
}

async function verifySignUp(
  cognitoClient: CognitoClient,
  input: { username: string; session: string | null; code: string },
): Promise<VerifySignUpProviderResult> {
  try {
    const confirmOutput = await cognitoClient.confirmSignUp(
      input.username,
      input.code,
      input.session ?? undefined,
    )
    const authOutput = await cognitoClient.initiateAuth(
      input.username,
      confirmOutput.Session ?? input.session ?? undefined,
    )
    const authentication = authenticationFromResult(authOutput.AuthenticationResult)
    if (!authentication) {
      return { outcome: 'incomplete-authentication' }
    }
    return { outcome: 'authenticated', authentication }
  } catch (error) {
    const mapped = mapVerifyException(error, 'already-confirmed')
    if (mapped) {
      return mapped
    }
    throw error
  }
}

async function verifySignIn(
  cognitoClient: CognitoClient,
  input: { username: string; session: string; code: string },
): Promise<VerifySignInProviderResult> {
  try {
    const output = await cognitoClient.respondToAuthChallenge(
      input.username,
      input.session,
      input.code,
    )
    const authentication = authenticationFromResult(output.AuthenticationResult)
    if (!authentication) {
      return { outcome: 'incomplete-authentication' }
    }
    return { outcome: 'authenticated', authentication }
  } catch (error) {
    const mapped = mapVerifyException(error, 'authentication-failed')
    if (mapped) {
      return mapped
    }
    throw error
  }
}

export function createCognitoAuthProvider(cognitoClient: CognitoClient): AuthProvider {
  return {
    signUp: (email) => signUp(cognitoClient, email),
    resendSignUpCode: (email) => resendSignUpCode(cognitoClient, email),
    startSignIn: (email, session) => startSignIn(cognitoClient, email, session),
    verifySignUp: (input) => verifySignUp(cognitoClient, input),
    verifySignIn: (input) => verifySignIn(cognitoClient, input),
  }
}
