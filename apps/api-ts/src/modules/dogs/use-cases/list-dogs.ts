import type { OwnerRepository } from '../../owners/index.js'
import type { DogRepository } from '../repository.js'
import type { ListDogs } from '../types.js'

export function createListDogs(
  owners: OwnerRepository,
  dogs: DogRepository,
): ListDogs {
  return async (cognitoSubject) => {
    const owner = await owners.resolveByCognitoSubject(cognitoSubject)
    return dogs.listByOwner(owner.ownerId)
  }
}
