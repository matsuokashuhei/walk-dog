import type { OwnerRepository } from '../../owners/index.js'
import {
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../errors.js'
import type { WalkRepository } from '../repository.js'
import type { DeleteWalk } from '../types.js'

export function createDeleteWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
): DeleteWalk {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    try {
      await walks.fail({
        ownerId: owner.ownerId,
        walkId: input.walkId,
      })
      return { ok: true }
    } catch (error) {
      if (error instanceof WalkNotFoundError) {
        return { ok: false, error: 'not_found' }
      }
      if (error instanceof WalkNotRecordingError) {
        return { ok: false, error: 'walk_not_recording' }
      }
      throw error
    }
  }
}
