import type { AuthProvider } from '../provider.js'
import type { OwnerRepository } from '../../owners/repository.js'
import type { VerifySignIn } from '../types.js'

export function createVerifySignIn(
  provider: AuthProvider,
  owners: OwnerRepository,
): VerifySignIn {
  return async (input) => {
    const result = await provider.verifySignIn(input)
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
