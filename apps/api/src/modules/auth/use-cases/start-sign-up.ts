import type { AuthProvider } from '../provider.js'
import type { StartSignUp } from '../types.js'

export function createStartSignUp(provider: AuthProvider): StartSignUp {
  return async (input) => {
    const signUpResult = await provider.signUp(input.email)
    if (signUpResult.outcome === 'signed-up') {
      return {
        outcome: 'challenge',
        username: input.email,
        session: signUpResult.session,
        codeDelivery: signUpResult.codeDelivery,
      }
    }
    if (signUpResult.outcome === 'username-exists') {
      const resendResult = await provider.resendSignUpCode(input.email)
      if (resendResult.outcome === 'code-sent') {
        return {
          outcome: 'challenge',
          username: input.email,
          session: null,
          codeDelivery: resendResult.codeDelivery,
        }
      }
      return { outcome: resendResult.outcome }
    }
    return { outcome: signUpResult.outcome }
  }
}
