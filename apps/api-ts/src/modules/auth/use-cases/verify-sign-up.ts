import type { AuthProvider } from '../provider.js'
import type { OwnerRepository } from '../../owners/repository.js'
import type { VerifySignUp } from '../types.js'

export function createVerifySignUp(
  provider: AuthProvider,
  owners: OwnerRepository,
): VerifySignUp {
  return async (input) => {
    const result = await provider.verifySignUp(input)
    if (result.outcome !== 'authenticated') {
      return { outcome: result.outcome }
    }
    const owner = await owners.resolveByCognitoSubject(result.authentication.subject)
    return {
      outcome: 'authenticated',
      authentication: result.authentication,
      owner,
    }
  }
}
