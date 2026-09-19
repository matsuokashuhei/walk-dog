import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConfirmedTrackPoint } from '../../../../src/modules/walks/provider.js'
import { pathDistanceMeters } from '../../../../src/modules/walks/path-distance.js'
import {
  bodyHash,
  createFinishWalkSut,
  finishInput,
  idempotencyKey,
  owner,
  recordedAt,
  walk,
  walkId,
} from './finish-walk-test-support.js'

test('finishWalk with zero points returns distanceMeters 0 and null pace', async () => {
  const { finishWalk, finishCalls, listPointsCalls } = createFinishWalkSut()

  const result = await finishWalk(finishInput)
  assert.deepEqual(result, { ok: true, walk })
  assert.equal(walk.distanceMeters, 0)
  assert.equal(walk.paceSecondsPerMeter, null)
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
  const { finishWalk, finishCalls, listPointsCalls } = createFinishWalkSut({
    listAccepted: async () => points.map((point) => point.recordedAt),
    listConfirmed: async () => points.map((point) => point.recordedAt),
    listPoints: async () => points,
  })

  const result = await finishWalk(finishInput)
  assert.ok(result.ok)
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
  const { finishWalk, finishCalls, confirmedCalls, listPointsCalls } = createFinishWalkSut({
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
  const { finishWalk, finishCalls } = createFinishWalkSut({
    listAccepted: async () => [recordedAt],
    listConfirmed: async () => [],
    nowValues: [0, 30_001],
    sleepCalls,
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'service_unavailable' })
  assert.deepEqual(finishCalls, [])
  assert.deepEqual(sleepCalls, [])
})

test('finishWalk returns service_unavailable when listRecordedAt throws during confirmation wait', async () => {
  const failure = new Error('dynamodb unavailable')
  const { finishWalk, finishCalls } = createFinishWalkSut({
    listAccepted: async () => [recordedAt],
    listConfirmed: async () => {
      throw failure
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'service_unavailable' })
  assert.deepEqual(finishCalls, [])
})

test('finishWalk returns service_unavailable when listPoints throws after confirmation', async () => {
  const failure = new Error('dynamodb unavailable')
  const { finishWalk, finishCalls, listPointsCalls } = createFinishWalkSut({
    listAccepted: async () => [recordedAt],
    listConfirmed: async () => [recordedAt],
    listPoints: async () => {
      throw failure
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'service_unavailable' })
  assert.deepEqual(listPointsCalls, [walkId])
  assert.deepEqual(finishCalls, [])
})
