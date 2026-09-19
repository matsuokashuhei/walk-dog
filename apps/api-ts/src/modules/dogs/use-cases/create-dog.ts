import type { OwnerRepository } from '../../owners/index.js'
import { DogNameDuplicateError } from '../errors.js'
import type { DogRepository } from '../repository.js'
import type { CreateDog } from '../types.js'

export function createCreateDog(
  owners: OwnerRepository,
  dogs: DogRepository,
): CreateDog {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    try {
      const dog = await dogs.createWithDailyGoal(owner.ownerId, {
        name: input.name,
        gender: input.gender,
        birthday: input.birthday,
      })
      return { ok: true, dog }
    } catch (error) {
      if (error instanceof DogNameDuplicateError) {
        return { ok: false, error: 'duplicate_name' }
      }
      throw error
    }
  }
}
