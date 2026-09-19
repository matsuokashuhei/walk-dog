import type { OwnerRepository } from '../../owners/index.js'
import type { WalkRepository } from '../repository.js'
import type { GetActiveWalk } from '../types.js'

export function createGetActiveWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
): GetActiveWalk {
  return async (cognitoSubject) => {
    const owner = await owners.resolveByCognitoSubject(cognitoSubject)
    return walks.getActiveByOwner(owner.ownerId)
  }
}
