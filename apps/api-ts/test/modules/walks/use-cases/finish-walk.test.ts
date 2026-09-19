import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../../src/modules/walks/errors.js'
import {
  bodyHash,
  createFinishWalkSut,
  finishInput,
  idempotencyKey,
  owner,
  walk,
  walkId,
} from './finish-walk-test-support.js'

test('finishWalk completes immediately when there are no accepted points', async () => {
  const { finishWalk, finishCalls, confirmedCalls, listPointsCalls, listAcceptedCalls } = createFinishWalkSut({
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

test('finishWalk returns not_found when listAcceptedRecordedAt throws WalkNotFoundError', async () => {
  const { finishWalk, finishCalls } = createFinishWalkSut({
    listAccepted: async () => {
      throw new WalkNotFoundError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'not_found' })
  assert.deepEqual(finishCalls, [])
})

test('finishWalk returns completed walk when listAcceptedRecordedAt throws WalkNotRecordingError and finish replays', async () => {
  const { finishWalk, finishCalls } = createFinishWalkSut({
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
  const { finishWalk, finishCalls } = createFinishWalkSut({
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

test('finishWalk returns not_found when the walk is missing', async () => {
  const { finishWalk } = createFinishWalkSut({
    finish: async () => {
      throw new WalkNotFoundError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'not_found' })
})

test('finishWalk returns walk_not_recording when the walk is not recording', async () => {
  const { finishWalk } = createFinishWalkSut({
    finish: async () => {
      throw new WalkNotRecordingError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'walk_not_recording' })
})

test('finishWalk returns idempotency_conflict when the same key has a different body', async () => {
  const { finishWalk } = createFinishWalkSut({
    finish: async () => {
      throw new IdempotencyConflictError()
    },
  })

  assert.deepEqual(await finishWalk(finishInput), { ok: false, error: 'idempotency_conflict' })
})

test('finishWalk does not finish a walk when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const { finishWalk, finishCalls, listAcceptedCalls } = createFinishWalkSut({
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
  const { finishWalk } = createFinishWalkSut({
    finish: async () => {
      throw failure
    },
  })

  await assert.rejects(() => finishWalk(finishInput), failure)
})
