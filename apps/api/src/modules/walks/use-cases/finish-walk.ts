import { createHash } from 'node:crypto'
import type { OwnerRepository } from '../../owners/index.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../errors.js'
import type { WalkRepository } from '../repository.js'
import type { FinishWalk } from '../types.js'

export function createFinishWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
): FinishWalk {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    const bodyHash = createHash('sha256').update('{}').digest('hex')
    try {
      const walk = await walks.finish({
        ownerId: owner.ownerId,
        walkId: input.walkId,
        idempotencyKey: input.idempotencyKey,
        bodyHash,
      })
      return { ok: true, walk }
    } catch (error) {
      if (error instanceof WalkNotFoundError) {
        return { ok: false, error: 'not_found' }
      }
      if (error instanceof WalkNotRecordingError) {
        return { ok: false, error: 'walk_not_recording' }
      }
      if (error instanceof IdempotencyConflictError) {
        return { ok: false, error: 'idempotency_conflict' }
      }
      throw error
    }
  }
}
