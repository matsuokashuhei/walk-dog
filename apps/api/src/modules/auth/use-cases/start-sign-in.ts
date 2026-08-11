import type { AuthProvider } from '../provider.js'
import type { StartSignIn } from '../types.js'

export function createStartSignIn(provider: AuthProvider): StartSignIn {
  return async (input) => {
    const result = await provider.startSignIn(input.email)
    switch (result.outcome) {
      case 'challenge':
        return {
          outcome: 'challenge',
          username: input.email,
          session: result.session,
          codeDelivery: result.codeDelivery,
        }
      case 'incomplete-challenge':
        return { outcome: 'incomplete-challenge' }
      case 'authentication-failed':
        return { outcome: 'authentication-failed' }
      case 'rate-limited':
        return { outcome: 'rate-limited' }
    }
  }
}
