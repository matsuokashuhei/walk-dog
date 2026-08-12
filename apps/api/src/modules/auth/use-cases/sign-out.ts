import type { OwnerRepository } from '../../owners/repository.js'
import type { ActiveWalkCommands } from '../../walks/active-walk-commands.js'
import type { AuthProvider } from '../provider.js'
import type { SignOut } from '../types.js'

export function createSignOut(
  ownerRepository: OwnerRepository,
  activeWalkCommands: ActiveWalkCommands,
  authProvider: AuthProvider,
): SignOut {
  return async (input) => {
    const owner = await ownerRepository.resolveByCognitoSubject(input.cognitoSubject)
    await activeWalkCommands.failIfPresent({ ownerId: owner.ownerId })
    return authProvider.signOut(input.accessToken)
  }
}
