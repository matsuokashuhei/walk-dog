import type { OwnerRepository } from '../../owners/index.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../errors.js'
import type { TrackPointQueue } from '../provider.js'
import type { WalkRepository } from '../repository.js'
import type { AcceptTrackPoint } from '../types.js'

export function createAcceptTrackPoint(
  owners: OwnerRepository,
  walks: WalkRepository,
  queue: TrackPointQueue,
): AcceptTrackPoint {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    try {
      const trackPoint = await walks.acceptTrackPoint({
        ownerId: owner.ownerId,
        walkId: input.walkId,
        recordedAt: input.recordedAt,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      await queue.enqueue(trackPoint)
      return { ok: true, trackPoint }
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
