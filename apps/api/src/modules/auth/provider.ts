import type { CodeDelivery } from './types.js'

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

export interface AuthProvider {
  signUp(email: string): Promise<SignUpProviderResult>
  resendSignUpCode(email: string): Promise<ResendSignUpCodeProviderResult>
  startSignIn(email: string, session?: string): Promise<StartSignInProviderResult>
}
