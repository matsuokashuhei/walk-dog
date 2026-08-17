import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../../src/modules/walks/errors.js'
import type { TrackPointQueue } from '../../../../src/modules/walks/provider.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import type { AcceptTrackPointInput, TrackPoint } from '../../../../src/modules/walks/types.js'
import { createAcceptTrackPoint } from '../../../../src/modules/walks/use-cases/accept-track-point.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const recordedAt = new Date('2026-08-17T03:12:14.000Z')

const expectedTrackPoint: TrackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

const acceptInput = {
  cognitoSubject: 'sub-1',
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(acceptTrackPoint: WalkRepository['acceptTrackPoint']): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    async start() {
      throw new Error('unexpected start')
    },
    async finish() {
      throw new Error('unexpected finish')
    },
    async fail() {
      throw new Error('unexpected fail')
    },
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
    acceptTrackPoint,
  }
}

function queueFake(enqueue: TrackPointQueue['enqueue']): TrackPointQueue {
  return { enqueue }
}

test('acceptTrackPoint resolves the owner, accepts, enqueues, and returns the point', async () => {
  const accepted: AcceptTrackPointInput[] = []
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    }),
    walksFake(async (input) => {
      accepted.push(input)
      return expectedTrackPoint
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )
  assert.deepEqual(await accept(acceptInput), { ok: true, trackPoint: expectedTrackPoint })
  assert.deepEqual(accepted, [{
    ownerId: owner.ownerId,
    walkId,
    recordedAt,
    latitude: 35.681236,
    longitude: 139.767125,
  }])
  assert.deepEqual(enqueued, [expectedTrackPoint])
})

test('acceptTrackPoint maps WalkNotFoundError to not_found and does not enqueue', async () => {
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotFoundError()
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )

  assert.deepEqual(await accept(acceptInput), { ok: false, error: 'not_found' })
  assert.deepEqual(enqueued, [])
})

test('acceptTrackPoint maps WalkNotRecordingError to walk_not_recording', async () => {
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotRecordingError()
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )

  assert.deepEqual(await accept(acceptInput), { ok: false, error: 'walk_not_recording' })
  assert.deepEqual(enqueued, [])
})

test('acceptTrackPoint maps IdempotencyConflictError to idempotency_conflict', async () => {
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new IdempotencyConflictError()
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )

  assert.deepEqual(await accept(acceptInput), { ok: false, error: 'idempotency_conflict' })
  assert.deepEqual(enqueued, [])
})

test('acceptTrackPoint enqueues on replay of the same coordinates', async () => {
  const accepted: AcceptTrackPointInput[] = []
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async (input) => {
      accepted.push(input)
      return expectedTrackPoint
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )

  assert.deepEqual(await accept(acceptInput), { ok: true, trackPoint: expectedTrackPoint })
  assert.equal(accepted.length, 1)
  assert.deepEqual(enqueued, [expectedTrackPoint])
})

test('acceptTrackPoint does not accept or enqueue when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const accepted: string[] = []
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => {
      throw failure
    }),
    walksFake(async () => {
      accepted.push('accept')
      return expectedTrackPoint
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )

  await assert.rejects(() => accept(acceptInput), failure)
  assert.deepEqual(accepted, [])
  assert.deepEqual(enqueued, [])
})

test('acceptTrackPoint propagates unexpected repository errors by identity', async () => {
  const failure = new Error('insert failed')
  const enqueued: TrackPoint[] = []
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw failure
    }),
    queueFake(async (message) => {
      enqueued.push(message)
    }),
  )

  await assert.rejects(() => accept(acceptInput), failure)
  assert.deepEqual(enqueued, [])
})

test('acceptTrackPoint propagates enqueue failures by identity', async () => {
  const failure = new Error('sqs')
  const accept = createAcceptTrackPoint(
    ownersFake(async () => owner),
    walksFake(async () => expectedTrackPoint),
    queueFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(() => accept(acceptInput), failure)
})
