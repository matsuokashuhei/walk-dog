import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { Owner } from '../../../../src/modules/owners/index.js'
import type { OwnerRepository } from '../../../../src/modules/owners/repository.js'
import {
  ActiveWalkExistsError,
  IdempotencyConflictError,
  WalkNotFoundError,
} from '../../../../src/modules/walks/errors.js'
import type { WalkRepository } from '../../../../src/modules/walks/repository.js'
import type { RecordingWalk, StartWalkInput } from '../../../../src/modules/walks/types.js'
import { createStartWalk } from '../../../../src/modules/walks/use-cases/start-walk.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const participantDogIds = [
  '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e72',
]
const idempotencyKey = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90'
const bodyHash = createHash('sha256')
  .update(JSON.stringify({ participantDogIds }))
  .digest('hex')

const walk: RecordingWalk = {
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  ownerId: owner.ownerId,
  state: 'recording',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: participantDogIds[0],
      name: 'Mugi',
    },
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e82',
      dogId: participantDogIds[1],
      name: 'Sora',
    },
  ],
}

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(start: WalkRepository['start']): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    start,
    async finish() {
      throw new Error('unexpected finish')
    },
    async fail() {
      throw new Error('unexpected fail')
    },
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
    async acceptTrackPoint() {
      throw new Error('unexpected acceptTrackPoint')
    },
    async listAcceptedRecordedAt() {
      throw new Error('unexpected listAcceptedRecordedAt')
    },
    async recordEvent() {
      throw new Error('unexpected recordEvent')
    },
  }
}

test('startWalk hashes the body and starts a walk after resolving the owner', async () => {
  const calls: StartWalkInput[] = []
  const startWalk = createStartWalk(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, 'sub-1')
      return owner
    }),
    walksFake(async (input) => {
      calls.push(input)
      return walk
    }),
  )

  assert.deepEqual(
    await startWalk({
      cognitoSubject: 'sub-1',
      participantDogIds,
      idempotencyKey,
    }),
    { ok: true, walk },
  )
  assert.deepEqual(calls, [{
    ownerId: owner.ownerId,
    participantDogIds,
    idempotencyKey,
    bodyHash,
  }])
})

test('startWalk returns active_walk_exists when a recording walk already exists', async () => {
  const startWalk = createStartWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new ActiveWalkExistsError()
    }),
  )

  assert.deepEqual(
    await startWalk({
      cognitoSubject: 'sub-1',
      participantDogIds,
      idempotencyKey,
    }),
    { ok: false, error: 'active_walk_exists' },
  )
})

test('startWalk returns not_found when a participant dog is missing', async () => {
  const startWalk = createStartWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotFoundError()
    }),
  )

  assert.deepEqual(
    await startWalk({
      cognitoSubject: 'sub-1',
      participantDogIds,
      idempotencyKey,
    }),
    { ok: false, error: 'not_found' },
  )
})

test('startWalk returns idempotency_conflict when the same key has a different body', async () => {
  const startWalk = createStartWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new IdempotencyConflictError()
    }),
  )

  assert.deepEqual(
    await startWalk({
      cognitoSubject: 'sub-1',
      participantDogIds,
      idempotencyKey,
    }),
    { ok: false, error: 'idempotency_conflict' },
  )
})

test('startWalk does not start a walk when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const startWalk = createStartWalk(
    ownersFake(async () => {
      throw failure
    }),
    walksFake(async () => {
      calls.push('start')
      return walk
    }),
  )

  await assert.rejects(
    () => startWalk({
      cognitoSubject: 'sub-1',
      participantDogIds,
      idempotencyKey,
    }),
    failure,
  )
  assert.deepEqual(calls, [])
})

test('startWalk propagates unexpected repository errors by identity', async () => {
  const failure = new Error('insert failed')
  const startWalk = createStartWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(
    () => startWalk({
      cognitoSubject: 'sub-1',
      participantDogIds,
      idempotencyKey,
    }),
    failure,
  )
})
