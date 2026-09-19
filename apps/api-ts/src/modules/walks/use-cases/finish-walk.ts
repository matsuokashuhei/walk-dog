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

type FinishWalkDeps = {
  owners: OwnerRepository
  walks: WalkRepository
  confirmed: ConfirmedTrackPoints
  clock: FinishWalkClock
  sleep: FinishWalkSleep
  timeoutMs: number
}

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

async function loadConfirmedPoints(
  confirmed: ConfirmedTrackPoints,
  walkId: string,
  acceptedCount: number,
): Promise<{ ok: true; points: Awaited<ReturnType<ConfirmedTrackPoints['listPoints']>> } | { ok: false; error: 'service_unavailable' }> {
  if (acceptedCount === 0) {
    return { ok: true, points: [] }
  }
  try {
    return { ok: true, points: await confirmed.listPoints(walkId) }
  } catch {
    return { ok: false, error: 'service_unavailable' }
  }
}

async function finishWalk(
  deps: FinishWalkDeps,
  input: Parameters<FinishWalk>[0],
): Promise<Awaited<ReturnType<FinishWalk>>> {
  const owner = await deps.owners.resolveByCognitoSubject(input.cognitoSubject)
  const bodyHash = createHash('sha256').update('{}').digest('hex')
  try {
    const accepted = await loadAccepted(deps.walks, owner.ownerId, input.walkId)
    if (accepted.length > 0) {
      const status = await waitForConfirmation(
        deps.confirmed,
        deps.clock,
        deps.sleep,
        deps.timeoutMs,
        input.walkId,
        accepted,
      )
      if (status === 'service_unavailable') {
        return { ok: false, error: 'service_unavailable' }
      }
    }
    const loaded = await loadConfirmedPoints(deps.confirmed, input.walkId, accepted.length)
    if (!loaded.ok) {
      return loaded
    }
    const distanceMeters = pathDistanceMeters(loaded.points)
    const walk = await deps.walks.finish({
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

export function createFinishWalk(
  owners: OwnerRepository,
  walks: WalkRepository,
  confirmed: ConfirmedTrackPoints,
  clock: FinishWalkClock,
  sleep: FinishWalkSleep,
  timeoutMs: number,
): FinishWalk {
  const deps = { owners, walks, confirmed, clock, sleep, timeoutMs }
  return async (input) => finishWalk(deps, input)
}
