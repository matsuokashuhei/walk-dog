import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../../src/modules/walks/errors.js'
import type { ConfirmedTrackPoint, ConfirmedTrackPoints } from '../../../../src/modules/walks/provider.js'
import { pathDistanceMeters } from '../../../../src/modules/walks/path-distance.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import type { CompletedWalk, FinishWalkInput } from '../../../../src/modules/walks/types.js'
import { createFinishWalk } from '../../../../src/modules/walks/use-cases/finish-walk.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const idempotencyKey = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e91'
const bodyHash = createHash('sha256').update('{}').digest('hex')
const recordedAt = new Date('2026-09-06T03:12:14.000Z')

const walk: CompletedWalk = {
  walkId,
  ownerId: owner.ownerId,
  state: 'completed',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: new Date('2026-08-15T03:44:04.000Z'),
  durationSeconds: 1920,
  distanceMeters: 0,
  paceSecondsPerMeter: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      name: 'Mugi',
    },
  ],
}

const finishInput = {
  cognitoSubject: 'sub-1',
  walkId,
  idempotencyKey,
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(opts: {
  finish: WalkRepository['finish']
  listAccepted: WalkRepository['listAcceptedRecordedAt']
}): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    async start() {
      throw new Error('unexpected start')
    },
    finish: opts.finish,
    async fail() {
      throw new Error('unexpected fail')
    },
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
    async acceptTrackPoint() {
      throw new Error('unexpected acceptTrackPoint')
    },
    listAcceptedRecordedAt: opts.listAccepted,
    async recordEvent() {
      throw new Error('unexpected recordEvent')
    },
  }
}

function createSut(opts: {
  listAccepted?: WalkRepository['listAcceptedRecordedAt']
  finish?: WalkRepository['finish']
  listConfirmed?: ConfirmedTrackPoints['listRecordedAt']
  listPoints?: ConfirmedTrackPoints['listPoints']
  nowValues?: number[]
  sleepCalls?: number[]
  resolveByCognitoSubject?: OwnerRepository['resolveByCognitoSubject']
} = {}) {
  const remainingNow = [...(opts.nowValues ?? [])]
  const finishCalls: FinishWalkInput[] = []
  const confirmedCalls: string[] = []
  const listPointsCalls: string[] = []
  const listAcceptedCalls: { ownerId: string; walkId: string }[] = []
  const finishWalk = createFinishWalk(
    ownersFake(opts.resolveByCognitoSubject ?? (async () => owner)),
    walksFake({
      async listAccepted(input) {
        listAcceptedCalls.push(input)
        if (opts.listAccepted) {
          return opts.listAccepted(input)
        }
        return []
      },
      async finish(input) {
        finishCalls.push(input)
        if (opts.finish) {
          return opts.finish(input)
        }
        return {
          ...walk,
          distanceMeters: input.distanceMeters,
          paceSecondsPerMeter: input.distanceMeters > 0
            ? walk.durationSeconds / input.distanceMeters
            : null,
        }
      },
    }),
    {
      async listRecordedAt(targetWalkId) {
        confirmedCalls.push(targetWalkId)
        if (opts.listConfirmed) {
          return opts.listConfirmed(targetWalkId)
        }
        throw new Error('unexpected listRecordedAt')
      },
      async listPoints(targetWalkId) {
        listPointsCalls.push(targetWalkId)
        if (opts.listPoints) {
          return opts.listPoints(targetWalkId)
        }
        throw new Error('unexpected listPoints')
      },
    },
    {
      now() {
        const next = remainingNow.shift()
        if (next === undefined) {
          return 0
        }
        return next
      },
    },
    {
      async sleep(durationMs) {
        opts.sleepCalls?.push(durationMs)
      },
    },
    30_000,
  )
  return { finishWalk, finishCalls, confirmedCalls, listPointsCalls, listAcceptedCalls }
}

test('finishWalk completes immediately when there are no accepted points', async () => {
  const { finishWalk, finishCalls, confirmedCalls, listPointsCalls, listAcceptedCalls } = createSut({
    resolveByCognitoSubject: async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: true, walk })
  assert.deepEqual(listAcceptedCalls, [{ ownerId: owner.ownerId, walkId }])
  assert.deepEqual(confirmedCalls, [])
  assert.deepEqual(listPointsCalls, [])
  assert.deepEqual(finishCalls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
    distanceMeters: 0,
  }])
})

test('finishWalk with zero points returns distanceMeters 0 and null pace', async () => {
  const { finishWalk, finishCalls, listPointsCalls } = createSut()

  const result = await finishWalk(finishInput)
  assert.deepEqual(result, { ok: true, walk })
  assert.equal(result.ok && result.walk.distanceMeters, 0)
  assert.equal(result.ok && result.walk.paceSecondsPerMeter, null)
  assert.deepEqual(listPointsCalls, [])
  assert.deepEqual(finishCalls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
    distanceMeters: 0,
  }])
})

test('finishWalk stores path distance from confirmed points', async () => {
  const points: ConfirmedTrackPoint[] = [
    {
      recordedAt: new Date('2026-09-06T03:12:14.000Z'),
      latitude: 35.0,
      longitude: 139.0,
    },
    {
      recordedAt: new Date('2026-09-06T03:13:00.000Z'),
      latitude: 35.001,
      longitude: 139.0,
    },
  ]
  const distanceMeters = pathDistanceMeters(points)
  const { finishWalk, finishCalls, listPointsCalls } = createSut({
    listAccepted: async () => points.map((point) => point.recordedAt),
    listConfirmed: async () => points.map((point) => point.recordedAt),
    listPoints: async () => points,
  })

  const result = await finishWalk(finishInput)
  assert.equal(result.ok, true)
  if (!result.ok) {
    throw new Error('expected ok')
  }
  assert.equal(result.walk.distanceMeters, distanceMeters)
  assert.equal(result.walk.paceSecondsPerMeter, walk.durationSeconds / distanceMeters)
  assert.deepEqual(listPointsCalls, [walkId])
  assert.deepEqual(finishCalls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
    distanceMeters,
  }])
})

test('finishWalk finishes after confirmed set covers accepted recordedAt', async () => {
  const sleepCalls: number[] = []
  const confirmedAt: Date[][] = [[], [recordedAt]]
  const point: ConfirmedTrackPoint = {
    recordedAt,
    latitude: 35.0,
    longitude: 139.0,
  }
  const { finishWalk, finishCalls, confirmedCalls, listPointsCalls } = createSut({
    listAccepted: async () => [recordedAt],
    listConfirmed: async () => confirmedAt.shift() ?? [recordedAt],
    listPoints: async () => [point],
    sleepCalls,
  })

  assert.deepEqual(await finishWalk(finishInput), {
    ok: true,
    walk: {
      ...walk,
      distanceMeters: 0,
      paceSecondsPerMeter: null,
    },
  })
  assert.deepEqual(confirmedCalls, [walkId, walkId])
  assert.deepEqual(listPointsCalls, [walkId])
  assert.deepEqual(sleepCalls, [200])
  assert.deepEqual(finishCalls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
    distanceMeters: 0,
  }])
})

test('finishWalk returns service_unavailable when timeout elapses before confirmation', async () => {
  const sleepCalls: number[] = []
  const { finishWalk, finishCalls } = createSut({
    listAccepted: async () => [recordedAt],
    listConfirmed: async () => [],
    nowValues: [0, 30_001],
    sleepCalls,
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'service_unavailable' })
  assert.deepEqual(finishCalls, [])
  assert.deepEqual(sleepCalls, [])
})

test('finishWalk returns not_found when listAcceptedRecordedAt throws WalkNotFoundError', async () => {
  const { finishWalk, finishCalls } = createSut({
    listAccepted: async () => {
      throw new WalkNotFoundError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'not_found' })
  assert.deepEqual(finishCalls, [])
})

test('finishWalk returns completed walk when listAcceptedRecordedAt throws WalkNotRecordingError and finish replays', async () => {
  const { finishWalk, finishCalls } = createSut({
    listAccepted: async () => {
      throw new WalkNotRecordingError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: true, walk })
  assert.deepEqual(finishCalls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
    distanceMeters: 0,
  }])
})

test('finishWalk returns walk_not_recording when listAcceptedRecordedAt and finish both throw WalkNotRecordingError', async () => {
  const { finishWalk, finishCalls } = createSut({
    listAccepted: async () => {
      throw new WalkNotRecordingError()
    },
    finish: async () => {
      throw new WalkNotRecordingError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'walk_not_recording' })
  assert.deepEqual(finishCalls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
    distanceMeters: 0,
  }])
})

test('finishWalk returns service_unavailable when listRecordedAt throws during confirmation wait', async () => {
  const failure = new Error('dynamodb unavailable')
  const { finishWalk, finishCalls } = createSut({
    listAccepted: async () => [recordedAt],
    listConfirmed: async () => {
      throw failure
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'service_unavailable' })
  assert.deepEqual(finishCalls, [])
})

test('finishWalk returns not_found when the walk is missing', async () => {
  const { finishWalk } = createSut({
    finish: async () => {
      throw new WalkNotFoundError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'not_found' })
})

test('finishWalk returns walk_not_recording when the walk is not recording', async () => {
  const { finishWalk } = createSut({
    finish: async () => {
      throw new WalkNotRecordingError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'walk_not_recording' })
})

test('finishWalk returns idempotency_conflict when the same key has a different body', async () => {
  const { finishWalk } = createSut({
    finish: async () => {
      throw new IdempotencyConflictError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'idempotency_conflict' })
})

test('finishWalk does not finish a walk when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const { finishWalk, finishCalls, listAcceptedCalls } = createSut({
    resolveByCognitoSubject: async () => {
      throw failure
    },
  })

  await assert.rejects(() => finishWalk(finishInput), failure)
  assert.deepEqual(listAcceptedCalls, [])
  assert.deepEqual(finishCalls, [])
})

test('finishWalk propagates unexpected repository errors by identity', async () => {
  const failure = new Error('update failed')
  const { finishWalk } = createSut({
    finish: async () => {
      throw failure
    },
  })

  await assert.rejects(() => finishWalk(finishInput), failure)
})
