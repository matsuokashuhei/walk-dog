import { createHash } from 'node:crypto'
import type { OwnerRepository } from '../../owners/index.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../errors.js'
import { pathDistanceMeters } from '../path-distance.js'
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
    let confirmedAt: Date[]
    try {
      confirmedAt = await confirmed.listRecordedAt(walkId)
    } catch {
      return 'service_unavailable'
    }
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

async function loadAccepted(
  walks: WalkRepository,
  ownerId: string,
  walkId: string,
): Promise<Date[]> {
  try {
    return await walks.listAcceptedRecordedAt({ ownerId, walkId })
  } catch (error) {
    if (!(error instanceof WalkNotRecordingError)) {
      throw error
    }
    return []
  }
}

function mapFinishError(
  error: unknown,
): { ok: false; error: 'not_found' | 'walk_not_recording' | 'idempotency_conflict' } | null {
  if (error instanceof WalkNotFoundError) {
    return { ok: false, error: 'not_found' }
  }
  if (error instanceof WalkNotRecordingError) {
    return { ok: false, error: 'walk_not_recording' }
  }
  if (error instanceof IdempotencyConflictError) {
    return { ok: false, error: 'idempotency_conflict' }
  }
  return null
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
      const accepted = await loadAccepted(walks, owner.ownerId, input.walkId)
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
      const points = accepted.length === 0 ? [] : await confirmed.listPoints(input.walkId)
      const distanceMeters = pathDistanceMeters(points)
      const walk = await walks.finish({
        ownerId: owner.ownerId,
        walkId: input.walkId,
        idempotencyKey: input.idempotencyKey,
        bodyHash,
        distanceMeters,
      })
      return { ok: true, walk }
    } catch (error) {
      const mapped = mapFinishError(error)
      if (mapped !== null) {
        return mapped
      }
      throw error
    }
  }
}
