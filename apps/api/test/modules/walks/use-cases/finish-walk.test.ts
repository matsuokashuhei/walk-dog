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

function ownersFake(resolve: OwnerRepository['resolveByCognitoSubject']): OwnerRepository {
  return {
    resolveByCognitoSubject: resolve,
    async updateDisplayName() {
      throw new Error('unexpected updateDisplayName')
    },
  }
}

function walksFake(finish: WalkRepository['finish']): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    async start() {
      throw new Error('unexpected start')
    },
    finish,
    async fail() {
      throw new Error('unexpected fail')
    },
    async failIfPresent() {
      throw new Error('unexpected failIfPresent')
    },
  }
}

test('finishWalk hashes the empty body and finishes the walk after resolving the owner', async () => {
  const calls: FinishWalkInput[] = []
  const finishWalk = createFinishWalk(
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
    await finishWalk({
      cognitoSubject: 'sub-1',
      walkId,
      idempotencyKey,
    }),
    { ok: true, walk },
  )
  assert.deepEqual(calls, [{
    ownerId: owner.ownerId,
    walkId,
    idempotencyKey,
    bodyHash,
  }])
})

test('finishWalk returns not_found when the walk is missing', async () => {
  const finishWalk = createFinishWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotFoundError()
    }),
  )

  assert.deepEqual(
    await finishWalk({
      cognitoSubject: 'sub-1',
      walkId,
      idempotencyKey,
    }),
    { ok: false, error: 'not_found' },
  )
})

test('finishWalk returns walk_not_recording when the walk is not recording', async () => {
  const finishWalk = createFinishWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotRecordingError()
    }),
  )

  assert.deepEqual(
    await finishWalk({
      cognitoSubject: 'sub-1',
      walkId,
      idempotencyKey,
    }),
    { ok: false, error: 'walk_not_recording' },
  )
})

test('finishWalk returns idempotency_conflict when the same key has a different body', async () => {
  const finishWalk = createFinishWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new IdempotencyConflictError()
    }),
  )

  assert.deepEqual(
    await finishWalk({
      cognitoSubject: 'sub-1',
      walkId,
      idempotencyKey,
    }),
    { ok: false, error: 'idempotency_conflict' },
  )
})

test('finishWalk does not finish a walk when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const calls: string[] = []
  const finishWalk = createFinishWalk(
    ownersFake(async () => {
      throw failure
    }),
    walksFake(async () => {
      calls.push('finish')
      return walk
    }),
  )

  await assert.rejects(
    () => finishWalk({
      cognitoSubject: 'sub-1',
      walkId,
      idempotencyKey,
    }),
    failure,
  )
  assert.deepEqual(calls, [])
})

test('finishWalk propagates unexpected repository errors by identity', async () => {
  const failure = new Error('update failed')
  const finishWalk = createFinishWalk(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw failure
    }),
  )

  await assert.rejects(
    () => finishWalk({
      cognitoSubject: 'sub-1',
      walkId,
      idempotencyKey,
    }),
    failure,
  )
})
