import type { Owner } from '../owners/index.js'
import type { AuthFailure } from './errors.js'

export type CodeDelivery = {
  destination: string
  attribute: string
}

export type Authentication = {
  subject: string
  accessToken: string
  idToken: string
  refreshToken: string
}

export type StartSignUpResult =
  | {
    outcome: 'challenge'
    username: string
    session: string | null
    codeDelivery: CodeDelivery | null
  }
  | { outcome: Extract<AuthFailure, 'already-confirmed' | 'invalid-input' | 'rate-limited'> }

export type StartSignInResult =
  | {
    outcome: 'challenge'
    username: string
    session: string
    codeDelivery: CodeDelivery
  }
  | { outcome: Extract<AuthFailure, 'authentication-failed' | 'rate-limited'> }
  | { outcome: 'incomplete-challenge' }

type VerifySignUpInput = {
  username: string
  session: string | null
  code: string
}

type VerifySignInInput = {
  username: string
  session: string
  code: string
}

type AuthenticatedResult = {
  outcome: 'authenticated'
  authentication: Authentication
  owner: Owner
}

export type VerifySignUpResult =
  | AuthenticatedResult
  | {
    outcome: Extract<
      AuthFailure,
      'code-expired' | 'invalid-code' | 'code-already-used' | 'already-confirmed' | 'rate-limited'
    >
  }
  | { outcome: 'incomplete-authentication' }

export type VerifySignInResult =
  | AuthenticatedResult
  | {
    outcome: Extract<
      AuthFailure,
      'code-expired' | 'invalid-code' | 'code-already-used' | 'authentication-failed' | 'rate-limited'
    >
  }
  | { outcome: 'incomplete-authentication' }

export type StartSignUp = (input: { email: string }) => Promise<StartSignUpResult>
export type StartSignIn = (input: { email: string }) => Promise<StartSignInResult>
export type VerifySignUp = (input: VerifySignUpInput) => Promise<VerifySignUpResult>
export type VerifySignIn = (input: VerifySignInInput) => Promise<VerifySignInResult>
