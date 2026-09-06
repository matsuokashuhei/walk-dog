import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrizzleWalkRepository } from '../../../src/infrastructure/database/repositories/drizzle-walk-repository.js'
import { walkEvents } from '../../../src/infrastructure/database/schema/walk-event.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../src/modules/walks/errors.js'
import {
  createWalkDatabaseFake,
  isError,
  uniqueViolation,
} from './walk-repository-fake.js'
import {
  completedWalkRow,
  dogId1,
  dogId2,
  failedWalkRow,
  otherOwnerId,
  ownerId,
  participantRow1,
  recordingWalkRow,
  walkId,
} from './walk-repository-fixtures.js'

const eventId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90'
const occurredAt = new Date('2026-09-06T03:20:11.000Z')
const eventPkey = uniqueViolation('walk_events_pkey')

const recordEventInput = {
  ownerId,
  walkId,
  eventId,
  participantDogId: dogId1,
  type: 'pee' as const,
  occurredAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

const eventRow = {
  eventId,
  walkId,
  participantDogId: dogId1,
  type: 'pee' as const,
  occurredAt,
  latitude: 35.681236,
  longitude: 139.767125,
  createdAt: occurredAt,
}

const expectedEvent = {
  eventId,
  walkId,
  participantDogId: dogId1,
  type: 'pee' as const,
  occurredAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

test('recordEvent inserts an event for a recording walk participant', async () => {
  const { database, insertTables, insertValues } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], [participantRow1]],
    insertResults: [[eventRow]],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).recordEvent(recordEventInput),
    { event: expectedEvent, created: true },
  )
  assert.equal(insertTables.at(-1), walkEvents)
  assert.deepEqual(insertValues, [{
    eventId,
    walkId,
    participantDogId: dogId1,
    type: 'pee',
    occurredAt,
    latitude: 35.681236,
    longitude: 139.767125,
  }])
})

test('recordEvent returns created false when eventId and content match', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], [participantRow1], [eventRow]],
    insertError: eventPkey,
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).recordEvent(recordEventInput),
    { event: expectedEvent, created: false },
  )
  assert.equal(insertTables.at(-1), walkEvents)
})

test('recordEvent throws IdempotencyConflictError when eventId matches and content differs', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], [participantRow1], [{
      ...eventRow,
      type: 'poop',
    }]],
    insertError: eventPkey,
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).recordEvent(recordEventInput),
    isError(IdempotencyConflictError),
  )
  assert.equal(insertTables.at(-1), walkEvents)
})

test('recordEvent throws WalkNotFoundError when the walk is missing or owned by someone else', async () => {
  const missing = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(missing.database).recordEvent(recordEventInput),
    isError(WalkNotFoundError),
  )
  assert.deepEqual(missing.insertTables, [])

  const otherOwner = createWalkDatabaseFake({
    selectResults: [[{ ...recordingWalkRow, ownerId: otherOwnerId }]],
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(otherOwner.database).recordEvent(recordEventInput),
    isError(WalkNotFoundError),
  )
  assert.deepEqual(otherOwner.insertTables, [])
})

test('recordEvent throws WalkNotRecordingError when the walk is completed or failed', async () => {
  for (const walkRow of [completedWalkRow, failedWalkRow]) {
    const { database, insertTables } = createWalkDatabaseFake({ selectResults: [[walkRow]] })
    await assert.rejects(
      () => createDrizzleWalkRepository(database).recordEvent(recordEventInput),
      isError(WalkNotRecordingError),
    )
    assert.deepEqual(insertTables, [])
  }
})

test('recordEvent throws WalkNotFoundError when the dog is not a participant of the walk', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], []],
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).recordEvent({
      ...recordEventInput,
      participantDogId: dogId2,
    }),
    isError(WalkNotFoundError),
  )
  assert.deepEqual(insertTables, [])
})
