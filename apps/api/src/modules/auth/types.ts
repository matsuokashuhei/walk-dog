import type { AuthFailure } from './errors.js'

export type CodeDelivery = {
  destination: string
  attribute: string
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

export type StartSignUp = (input: { email: string }) => Promise<StartSignUpResult>
export type StartSignIn = (input: { email: string }) => Promise<StartSignInResult>
