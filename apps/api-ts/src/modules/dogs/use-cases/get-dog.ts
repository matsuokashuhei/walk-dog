import type { OwnerRepository } from '../../owners/index.js'
import type { DogRepository } from '../repository.js'
import type { GetDog } from '../types.js'

export function createGetDog(
  owners: OwnerRepository,
  dogs: DogRepository,
): GetDog {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    const dog = await dogs.getByOwnerAndId(owner.ownerId, input.dogId)
    if (dog === null) {
      return { ok: false, error: 'not_found' }
    }
    return { ok: true, dog }
  }
}
