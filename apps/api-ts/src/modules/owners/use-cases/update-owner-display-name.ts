import type { OwnerRepository } from '../repository.js'
import type { UpdateOwnerDisplayName } from '../types.js'

export function createUpdateOwnerDisplayName(
  owners: OwnerRepository,
): UpdateOwnerDisplayName {
  return (input) => owners.updateDisplayName(input.cognitoSubject, input.displayName)
}
