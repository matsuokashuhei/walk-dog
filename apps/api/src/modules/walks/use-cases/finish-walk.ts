import { createHash } from 'node:crypto'
import type { OwnerRepository } from '../../owners/index.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../errors.js'
import type { ConfirmedTrackPoints } from '../provider.js'
import type { WalkRepository } from '../repository.js'
import type { FinishWalk, FinishWalkClock, FinishWalkSleep } from '../types.js'

async function waitForConfirmation(
  confirmed: ConfirmedTrackPoints,
  clock: FinishWalkClock,
  sleep: FinishWalkSleep,
  timeoutMs: number,
  walkId: string,
  accepted: Date[],
): Promise<'confirmed' | 'service_unavailable'> {
  const deadline = clock.now() + timeoutMs
  const needed = new Set(accepted.map((recordedAt) => recordedAt.toISOString()))
  for (;;) {
    const confirmedAt = await confirmed.listRecordedAt(walkId)
    const have = new Set(confirmedAt.map((recordedAt) => recordedAt.toISOString()))
    if ([...needed].every((key) => have.has(key))) {
      return 'confirmed'
    }
    if (clock.now() >= deadline) {
      return 'service_unavailable'
    }
    await sleep.sleep(200)
  }
}

export function createFinishWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
  confirmed: ConfirmedTrackPoints,
  clock: FinishWalkClock,
  sleep: FinishWalkSleep,
  timeoutMs: number,
): FinishWalk {
  return async (input) => {
    const owner = await owners.resolveByCognitoSubject(input.cognitoSubject)
    const bodyHash = createHash('sha256').update('{}').digest('hex')
    try {
      const accepted = await walks.listAcceptedRecordedAt({
        ownerId: owner.ownerId,
        walkId: input.walkId,
      })
      if (accepted.length > 0) {
        const status = await waitForConfirmation(
          confirmed,
          clock,
          sleep,
          timeoutMs,
          input.walkId,
          accepted,
        )
        if (status === 'service_unavailable') {
          return { ok: false, error: 'service_unavailable' }
        }
      }
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
