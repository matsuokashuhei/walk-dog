import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrizzleWalkRepository } from '../../../src/infrastructure/database/repositories/drizzle-walk-repository.js'
import { walkEvents } from '../../../src/infrastructure/database/schema/walk-event.js'
import { WalkNotFoundError } from '../../../src/modules/walks/errors.js'
import {
  createWalkDatabaseFake,
  isError,
} from './walk-repository-fake.js'
import {
  completedWalkRow,
  dogId1,
  expectedCompletedWalk,
  failedWalkRow,
  otherOwnerId,
  ownerId,
  participantRow1,
  participantRow2,
  recordingWalkRow,
  walkId,
} from './walk-repository-fixtures.js'

const earlierOccurredAt = new Date('2026-09-06T03:20:11.000Z')
const laterOccurredAt = new Date('2026-09-06T03:30:00.000Z')

const earlierEventRow = {
  eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId,
  participantDogId: dogId1,
  type: 'pee' as const,
  occurredAt: earlierOccurredAt,
  latitude: 35.681236,
  longitude: 139.767125,
  createdAt: earlierOccurredAt,
}

const laterEventRow = {
  eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e91',
  walkId,
  participantDogId: dogId1,
  type: 'poop' as const,
  occurredAt: laterOccurredAt,
  latitude: 35.6814,
  longitude: 139.7673,
  createdAt: laterOccurredAt,
}

test('getCompletedByOwner returns a completed walk with participants', async () => {
  const { database, calls } = createWalkDatabaseFake({
    selectResults: [[completedWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).getCompletedByOwner({ ownerId, walkId }),
    expectedCompletedWalk,
  )
  assert.deepEqual(calls, ['select', 'orderBy', 'select'])
})

test('getCompletedByOwner throws WalkNotFoundError when the walk is missing', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).getCompletedByOwner({ ownerId, walkId }),
    isError(WalkNotFoundError),
  )
})

test('getCompletedByOwner throws WalkNotFoundError for another owner', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).getCompletedByOwner({
      ownerId: otherOwnerId,
      walkId,
    }),
    isError(WalkNotFoundError),
  )
})

test('getCompletedByOwner throws WalkNotFoundError for a recording walk', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[recordingWalkRow]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).getCompletedByOwner({ ownerId, walkId }),
    isError(WalkNotFoundError),
  )
})

test('getCompletedByOwner throws WalkNotFoundError for a failed walk', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[failedWalkRow]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).getCompletedByOwner({ ownerId, walkId }),
    isError(WalkNotFoundError),
  )
})

test('listEvents returns events ordered by occurredAt ascending', async () => {
  const { database, calls, selectTables } = createWalkDatabaseFake({
    selectResults: [[earlierEventRow, laterEventRow]],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).listEvents({ walkId }),
    [
      {
        eventId: earlierEventRow.eventId,
        walkId,
        participantDogId: dogId1,
        type: 'pee',
        occurredAt: earlierOccurredAt,
        latitude: 35.681236,
        longitude: 139.767125,
      },
      {
        eventId: laterEventRow.eventId,
        walkId,
        participantDogId: dogId1,
        type: 'poop',
        occurredAt: laterOccurredAt,
        latitude: 35.6814,
        longitude: 139.7673,
      },
    ],
  )
  assert.equal(selectTables[0], walkEvents)
  assert.deepEqual(calls, ['orderBy', 'select'])
})

test('listEvents returns an empty array when there are no events', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[]] })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).listEvents({ walkId }),
    [],
  )
})
