import { createHash } from 'node:crypto'
import type { OwnerRepository } from '../../owners/index.js'
import {
  ActiveWalkExistsError,
  IdempotencyConflictError,
  WalkNotFoundError,
} from '../errors.js'
import type { WalkRepository } from '../repository.js'
import type { StartWalk } from '../types.js'

export function createStartWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
): StartWalk {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    const bodyHash = createHash('sha256')
      .update(JSON.stringify({ participantDogIds: input.participantDogIds }))
      .digest('hex')
    try {
      const walk = await walks.start({
        ownerId: owner.ownerId,
        participantDogIds: input.participantDogIds,
        idempotencyKey: input.idempotencyKey,
        bodyHash,
      })
      return { ok: true, walk }
    } catch (error) {
      if (error instanceof ActiveWalkExistsError) {
        return { ok: false, error: 'active_walk_exists' }
      }
      if (error instanceof WalkNotFoundError) {
        return { ok: false, error: 'not_found' }
      }
      if (error instanceof IdempotencyConflictError) {
        return { ok: false, error: 'idempotency_conflict' }
      }
      throw error
    }
  }
}
