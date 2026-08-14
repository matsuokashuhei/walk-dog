import type { OwnerRepository } from '../repository.js'
import type { GetOwner } from '../types.js'

export function createGetOwner(owners: OwnerRepository): GetOwner {
  return (cognitoSubject) => owners.resolveByCognitoSubject(cognitoSubject)
}
