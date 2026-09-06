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
import type { RecordEventInput, WalkEvent } from '../../../../src/modules/walks/types.js'
import { createRecordEvent } from '../../../../src/modules/walks/use-cases/record-event.js'

const owner: Owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-02T15:23:48.068Z'),
  updatedAt: new Date('2026-08-02T15:23:48.068Z'),
}

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const eventId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90'
const participantDogId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70'
const occurredAt = new Date('2026-09-06T03:20:11.000Z')

const expectedEvent: WalkEvent = {
  eventId,
  walkId,
  participantDogId,
  type: 'pee',
  occurredAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

const recordInput = {
  cognitoSubject: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  walkId,
  eventId,
  participantDogId,
  type: 'pee' as const,
  occurredAt,
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

function walksFake(recordEvent: WalkRepository['recordEvent']): WalkRepository {
  return {
    async getActiveByOwner() {
      throw new Error('unexpected getActiveByOwner')
    },
    async getCompletedByOwner() {
      throw new Error('unexpected getCompletedByOwner')
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
    async acceptTrackPoint() {
      throw new Error('unexpected acceptTrackPoint')
    },
    async listAcceptedRecordedAt() {
      throw new Error('unexpected listAcceptedRecordedAt')
    },
    async listEvents() {
      throw new Error('unexpected listEvents')
    },
    recordEvent,
  }
}

test('recordEvent resolves the owner, records, and returns created true', async () => {
  const recorded: RecordEventInput[] = []
  const recordEvent = createRecordEvent(
    ownersFake(async (cognitoSubject) => {
      assert.equal(cognitoSubject, '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70')
      return owner
    }),
    walksFake(async (input) => {
      recorded.push(input)
      return { event: expectedEvent, created: true }
    }),
  )
  assert.deepEqual(await recordEvent(recordInput), {
    ok: true,
    event: expectedEvent,
    created: true,
  })
  assert.deepEqual(recorded, [{
    ownerId: owner.ownerId,
    walkId,
    eventId,
    participantDogId,
    type: 'pee',
    occurredAt,
    latitude: 35.681236,
    longitude: 139.767125,
  }])
})

test('recordEvent returns created false on idempotent replay', async () => {
  const recordEvent = createRecordEvent(
    ownersFake(async () => owner),
    walksFake(async () => ({ event: expectedEvent, created: false })),
  )
  assert.deepEqual(await recordEvent(recordInput), {
    ok: true,
    event: expectedEvent,
    created: false,
  })
})

test('recordEvent maps WalkNotFoundError to not_found', async () => {
  const recordEvent = createRecordEvent(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotFoundError()
    }),
  )
  assert.deepEqual(await recordEvent(recordInput), { ok: false, error: 'not_found' })
})

test('recordEvent maps WalkNotRecordingError to walk_not_recording', async () => {
  const recordEvent = createRecordEvent(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new WalkNotRecordingError()
    }),
  )
  assert.deepEqual(await recordEvent(recordInput), { ok: false, error: 'walk_not_recording' })
})

test('recordEvent maps IdempotencyConflictError to idempotency_conflict', async () => {
  const recordEvent = createRecordEvent(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw new IdempotencyConflictError()
    }),
  )
  assert.deepEqual(await recordEvent(recordInput), { ok: false, error: 'idempotency_conflict' })
})

test('recordEvent does not record when owner resolution fails', async () => {
  const failure = new Error('owner lookup failed')
  const recorded: string[] = []
  const recordEvent = createRecordEvent(
    ownersFake(async () => {
      throw failure
    }),
    walksFake(async () => {
      recorded.push('record')
      return { event: expectedEvent, created: true }
    }),
  )
  await assert.rejects(() => recordEvent(recordInput), failure)
  assert.deepEqual(recorded, [])
})

test('recordEvent propagates unexpected repository errors by identity', async () => {
  const failure = new Error('insert failed')
  const recordEvent = createRecordEvent(
    ownersFake(async () => owner),
    walksFake(async () => {
      throw failure
    }),
  )
  await assert.rejects(() => recordEvent(recordInput), failure)
})
