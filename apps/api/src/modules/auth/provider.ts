import type { Authentication, CodeDelivery } from './types.js'

export type SignUpProviderResult =
  | {
    outcome: 'signed-up'
    session: string | null
    codeDelivery: CodeDelivery | null
  }
  | { outcome: 'username-exists' }
  | { outcome: 'invalid-input' }
  | { outcome: 'rate-limited' }

export type ResendSignUpCodeProviderResult =
  | {
    outcome: 'code-sent'
    codeDelivery: CodeDelivery | null
  }
  | { outcome: 'already-confirmed' }
  | { outcome: 'rate-limited' }

export type StartSignInProviderResult =
  | {
    outcome: 'challenge'
    session: string
    codeDelivery: CodeDelivery
  }
  | { outcome: 'incomplete-challenge' }
  | { outcome: 'authentication-failed' }
  | { outcome: 'rate-limited' }

export type VerifySignUpProviderResult =
  | { outcome: 'authenticated'; authentication: Authentication }
  | { outcome: 'code-expired' }
  | { outcome: 'invalid-code' }
  | { outcome: 'code-already-used' }
  | { outcome: 'already-confirmed' }
  | { outcome: 'rate-limited' }
  | { outcome: 'incomplete-authentication' }

export type VerifySignInProviderResult =
  | { outcome: 'authenticated'; authentication: Authentication }
  | { outcome: 'code-expired' }
  | { outcome: 'invalid-code' }
  | { outcome: 'code-already-used' }
  | { outcome: 'authentication-failed' }
  | { outcome: 'rate-limited' }
  | { outcome: 'incomplete-authentication' }

export interface AuthProvider {
  signUp(email: string): Promise<SignUpProviderResult>
  resendSignUpCode(email: string): Promise<ResendSignUpCodeProviderResult>
  startSignIn(email: string, session?: string): Promise<StartSignInProviderResult>
  verifySignUp(input: { username: string; session: string | null; code: string }): Promise<VerifySignUpProviderResult>
  verifySignIn(input: { username: string; session: string; code: string }): Promise<VerifySignInProviderResult>
}
