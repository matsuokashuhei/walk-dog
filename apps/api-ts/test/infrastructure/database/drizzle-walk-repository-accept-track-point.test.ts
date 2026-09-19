import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrizzleWalkRepository } from '../../../src/infrastructure/database/repositories/drizzle-walk-repository.js'
import { walkTrackPoints } from '../../../src/infrastructure/database/schema/walk-track-point.js'
import {
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../src/modules/walks/errors.js'
import {
  createWalkDatabaseFake,
  isError,
} from './walk-repository-fake.js'
import {
  completedWalkRow,
  expectedTrackPoint,
  failedWalkRow,
  otherOwnerId,
  recordedAt,
  recordingWalkRow,
  trackPointInput,
  trackPointRow,
  trackPointUnique,
  walkId,
} from './walk-repository-fixtures.js'

test('acceptTrackPoint inserts an accepted point for a recording walk', async () => {
  const { database, insertTables, insertValues } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow]],
    insertResults: [[trackPointRow]],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
    expectedTrackPoint,
  )
  assert.equal(insertTables.at(-1), walkTrackPoints)
  assert.deepEqual(insertValues, [{
    walkId,
    recordedAt,
    latitude: 35.681236,
    longitude: 139.767125,
  }])
})

test('acceptTrackPoint returns the existing point when recordedAt and coordinates match', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], [trackPointRow]],
    insertError: trackPointUnique,
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
    expectedTrackPoint,
  )
  assert.equal(insertTables.at(-1), walkTrackPoints)
})

test('acceptTrackPoint throws IdempotencyConflictError when recordedAt matches and coordinates differ', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], [{
      ...trackPointRow,
      latitude: 35.689487,
      longitude: 139.691706,
    }]],
    insertError: trackPointUnique,
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
    isError(IdempotencyConflictError),
  )
  assert.equal(insertTables.at(-1), walkTrackPoints)
})

test('acceptTrackPoint throws WalkNotFoundError when the walk is missing or owned by someone else', async () => {
  const missing = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(missing.database).acceptTrackPoint(trackPointInput),
    isError(WalkNotFoundError),
  )
  assert.deepEqual(missing.insertTables, [])

  const otherOwner = createWalkDatabaseFake({
    selectResults: [[{ ...recordingWalkRow, ownerId: otherOwnerId }]],
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(otherOwner.database).acceptTrackPoint(trackPointInput),
    isError(WalkNotFoundError),
  )
  assert.deepEqual(otherOwner.insertTables, [])
})

test('acceptTrackPoint throws WalkNotRecordingError when the walk is completed or failed', async () => {
  for (const walkRow of [completedWalkRow, failedWalkRow]) {
    const { database, insertTables } = createWalkDatabaseFake({ selectResults: [[walkRow]] })
    await assert.rejects(
      () => createDrizzleWalkRepository(database).acceptTrackPoint(trackPointInput),
      isError(WalkNotRecordingError),
    )
    assert.deepEqual(insertTables, [])
  }
})
