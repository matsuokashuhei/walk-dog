import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrizzleWalkRepository } from '../../../src/infrastructure/database/repositories/drizzle-walk-repository.js'
import { walks } from '../../../src/infrastructure/database/schema/walk.js'
import { walkTrackPoints } from '../../../src/infrastructure/database/schema/walk-track-point.js'
import {
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../src/modules/walks/errors.js'
import {
  createWalkDatabaseFake,
  isError,
} from './walk-repository-fake.js'
import {
  completedWalkRow,
  otherOwnerId,
  ownerId,
  recordingWalkRow,
  walkId,
} from './walk-repository-fixtures.js'

test('listAcceptedRecordedAt returns recordedAt values for a recording walk', async () => {
  const recordedAt1 = new Date('2026-08-17T03:12:14.000Z')
  const recordedAt2 = new Date('2026-08-17T03:12:44.000Z')
  const { database, calls, selectTables } = createWalkDatabaseFake({
    selectResults: [
      [recordingWalkRow],
      [{ recordedAt: recordedAt1 }, { recordedAt: recordedAt2 }],
    ],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).listAcceptedRecordedAt({ ownerId, walkId }),
    [recordedAt1, recordedAt2],
  )
  assert.deepEqual(selectTables, [walks, walkTrackPoints])
  assert.deepEqual(calls, ['select', 'orderBy', 'select'])
})

test('listAcceptedRecordedAt returns empty array when there are no points', async () => {
  const { database, calls, selectTables } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], []],
  })
  assert.deepEqual(
    await createDrizzleWalkRepository(database).listAcceptedRecordedAt({ ownerId, walkId }),
    [],
  )
  assert.deepEqual(selectTables, [walks, walkTrackPoints])
  assert.deepEqual(calls, ['select', 'orderBy', 'select'])
})

test('listAcceptedRecordedAt throws WalkNotFoundError for another owner', async () => {
  const missing = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(missing.database).listAcceptedRecordedAt({ ownerId, walkId }),
    isError(WalkNotFoundError),
  )

  const otherOwner = createWalkDatabaseFake({ selectResults: [[]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(otherOwner.database).listAcceptedRecordedAt({ ownerId: otherOwnerId, walkId }),
    isError(WalkNotFoundError),
  )
})

test('listAcceptedRecordedAt throws WalkNotRecordingError when completed', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[completedWalkRow]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).listAcceptedRecordedAt({ ownerId, walkId }),
    isError(WalkNotRecordingError),
  )
})
