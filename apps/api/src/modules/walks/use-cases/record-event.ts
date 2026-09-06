import type { OwnerRepository } from '../../owners/index.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../errors.js'
import type { WalkRepository } from '../repository.js'
import type { RecordEvent } from '../types.js'

export function createRecordEvent(
  owners: OwnerRepository,
  walks: WalkRepository,
): RecordEvent {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    try {
      const result = await walks.recordEvent({
        ownerId: owner.ownerId,
        walkId: input.walkId,
        eventId: input.eventId,
        participantDogId: input.participantDogId,
        type: input.type,
        occurredAt: input.occurredAt,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      return { ok: true, event: result.event, created: result.created }
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
