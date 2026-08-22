import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrizzleWalkRepository } from '../../../src/infrastructure/database/repositories/drizzle-walk-repository.js'
import { dogs } from '../../../src/infrastructure/database/schema/dog.js'
import { walkCommandKeys } from '../../../src/infrastructure/database/schema/walk-command-key.js'
import { walkParticipants } from '../../../src/infrastructure/database/schema/walk-participant.js'
import { walkTrackPoints } from '../../../src/infrastructure/database/schema/walk-track-point.js'
import { walks } from '../../../src/infrastructure/database/schema/walk.js'
import {
  ActiveWalkExistsError,
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../src/modules/walks/errors.js'
import {
  createWalkDatabaseFake,
  isError,
  uniqueViolation,
  updateWhereGatesRecording,
} from './walk-repository-fake.js'
import {
  commandKeyUnique,
  completedWalkRow,
  dogId1,
  dogId2,
  expectedCompletedWalk,
  expectedRecordingWalk,
  expectedTrackPoint,
  failInput,
  failedWalkRow,
  finishCommandKeyRow,
  finishHash,
  finishInput,
  finishKey,
  otherOwnerId,
  ownedDogs,
  ownerId,
  participantRow1,
  participantRow2,
  recordedAt,
  recordingWalkRow,
  startCommandKeyRow,
  startHash,
  startInput,
  startKey,
  trackPointInput,
  trackPointRow,
  trackPointUnique,
  walkId,
} from './walk-repository-fixtures.js'



test('getActiveByOwner returns the recording walk with participants in position order', async () => {
  const { database, calls } = createWalkDatabaseFake({
    selectResults: [[recordingWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).getActiveByOwner(ownerId), expectedRecordingWalk)
  assert.deepEqual(calls, ['select', 'orderBy', 'select'])
})

test('getActiveByOwner returns null when no recording walk exists', async () => {
  const { database, calls } = createWalkDatabaseFake({ selectResults: [[]] })
  assert.equal(await createDrizzleWalkRepository(database).getActiveByOwner(ownerId), null)
  assert.deepEqual(calls, ['select'])
})

test('start inserts a recording walk, request-order participants, and a start command key', async () => {
  const { database, calls, insertTables, insertValues, selectTables } = createWalkDatabaseFake({
    selectResults: [[], [ownedDogs[1], ownedDogs[0]]],
    insertResults: [[recordingWalkRow], [participantRow1, participantRow2], [startCommandKeyRow]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).start(startInput), expectedRecordingWalk)
  assert.deepEqual(calls, ['transaction', 'select', 'select', 'insert', 'insert', 'insert'])
  assert.deepEqual(selectTables, [walkCommandKeys, dogs])
  assert.deepEqual(insertTables, [walks, walkParticipants, walkCommandKeys])
  const walkInsert = insertValues[0] as { ownerId: string; state: string; startedAt: Date; completedAt: null }
  assert.equal(walkInsert.ownerId, ownerId)
  assert.equal(walkInsert.state, 'recording')
  assert.equal(walkInsert.completedAt, null)
  assert.ok(walkInsert.startedAt instanceof Date)
  assert.deepEqual(insertValues[1], [
    { walkId, dogId: dogId1, name: 'Mugi', position: 0 },
    { walkId, dogId: dogId2, name: 'Sora', position: 1 },
  ])
  assert.deepEqual(insertValues[2], { ownerId, namespace: 'start', key: startKey, bodyHash: startHash, walkId })
})

test('start returns the existing walk when the start key and body hash match', async () => {
  const { database, calls, insertTables } = createWalkDatabaseFake({
    selectResults: [[startCommandKeyRow], [recordingWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).start(startInput), expectedRecordingWalk)
  assert.deepEqual(calls, ['transaction', 'select', 'select', 'orderBy', 'select'])
  assert.deepEqual(insertTables, [])
})

test('start throws IdempotencyConflictError when the start key matches with a different body hash', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[{ ...startCommandKeyRow, bodyHash: 'other-hash' }]] })
  await assert.rejects(() => createDrizzleWalkRepository(database).start(startInput), isError(IdempotencyConflictError))
})

test('start throws ActiveWalkExistsError on recording unique violation', async () => {
  const { database } = createWalkDatabaseFake({
    selectResults: [[], ownedDogs],
    insertError: uniqueViolation('walks_owner_id_recording_unique'),
  })
  await assert.rejects(() => createDrizzleWalkRepository(database).start(startInput), isError(ActiveWalkExistsError))
})

test('start replays the original walk when command-key unique violates with the same hash', async () => {
  const { database } = createWalkDatabaseFake({
    selectResults: [[], ownedDogs, [startCommandKeyRow], [recordingWalkRow], [participantRow1, participantRow2]],
    insertResults: [[recordingWalkRow], [participantRow1, participantRow2]],
    insertError: commandKeyUnique, insertErrorAtIndex: 2,
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).start(startInput), expectedRecordingWalk)
})


test('start throws IdempotencyConflictError when command-key unique violates with a different hash', async () => {
  const { database } = createWalkDatabaseFake({
    selectResults: [[], ownedDogs, [{ ...startCommandKeyRow, bodyHash: 'other-hash' }]],
    insertResults: [[recordingWalkRow], [participantRow1, participantRow2]],
    insertError: commandKeyUnique, insertErrorAtIndex: 2,
  })
  await assert.rejects(() => createDrizzleWalkRepository(database).start(startInput), isError(IdempotencyConflictError))
})

test('start throws WalkNotFoundError when a participant dog is missing or not owned', async () => {
  const { database, insertTables } = createWalkDatabaseFake({
    selectResults: [[], [{ dogId: dogId1, name: 'Mugi' }]],
  })
  await assert.rejects(() => createDrizzleWalkRepository(database).start(startInput), isError(WalkNotFoundError))
  assert.deepEqual(insertTables, [])
})

test('finish completes the recording walk and stores a finish command key', async () => {
  const { database, calls, insertTables, insertValues, updateTables, updateSets } = createWalkDatabaseFake({
    selectResults: [[], [recordingWalkRow], [participantRow1, participantRow2]],
    updateResult: [completedWalkRow],
    insertResults: [[finishCommandKeyRow]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).finish(finishInput), expectedCompletedWalk)
  assert.equal(calls[0], 'transaction')
  assert.ok(calls.includes('update'))
  assert.ok(calls.includes('insert'))
  assert.deepEqual(updateTables, [walks])
  const updateSet = updateSets[0] as { state: string; completedAt: Date }
  assert.equal(updateSet.state, 'completed')
  assert.ok(updateSet.completedAt instanceof Date)
  assert.deepEqual(insertTables, [walkCommandKeys])
  assert.deepEqual(insertValues[0], { ownerId, namespace: 'finish', key: finishKey, bodyHash: finishHash, walkId })
})

test('finish returns the existing completed walk when the finish key and body hash match', async () => {
  const { database, calls, insertTables, updateTables } = createWalkDatabaseFake({
    selectResults: [[finishCommandKeyRow], [completedWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).finish(finishInput), expectedCompletedWalk)
  assert.deepEqual(calls, ['transaction', 'select', 'select', 'orderBy', 'select'])
  assert.deepEqual(insertTables, [])
  assert.deepEqual(updateTables, [])
})

test('finish throws IdempotencyConflictError when the finish key matches with a different body hash', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[{ ...finishCommandKeyRow, bodyHash: 'other-hash' }]] })
  await assert.rejects(() => createDrizzleWalkRepository(database).finish(finishInput), isError(IdempotencyConflictError))
})

test('finish throws WalkNotFoundError for another owner or unknown walkId', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[], []] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).finish({ ...finishInput, ownerId: otherOwnerId }),
    isError(WalkNotFoundError),
  )
})

test('finish throws WalkNotRecordingError when the walk is not recording', async () => {
  const { database } = createWalkDatabaseFake({ selectResults: [[], [completedWalkRow]] })
  await assert.rejects(() => createDrizzleWalkRepository(database).finish(finishInput), isError(WalkNotRecordingError))
})

test('finish throws WalkNotRecordingError when failIfPresent wins after the recording pre-check', async () => {
  const { database, insertTables, insertValues, updateWheres } = createWalkDatabaseFake({
    selectResults: [[], [recordingWalkRow]],
    updateResult: [],
  })
  await assert.rejects(() => createDrizzleWalkRepository(database).finish(finishInput), isError(WalkNotRecordingError))
  assert.deepEqual(insertTables, [])
  assert.deepEqual(insertValues, [])
  assert.equal(updateWheres.length, 1)
  assert.equal(updateWhereGatesRecording(updateWheres[0]), true)
})

test('failIfPresent marks the recording walk as failed', async () => {
  const { database, calls, updateTables, updateSets } = createWalkDatabaseFake({
    updateResult: [{ ...recordingWalkRow, state: 'failed' }],
  })
  await createDrizzleWalkRepository(database).failIfPresent({ ownerId })
  assert.deepEqual(calls, ['update'])
  assert.deepEqual(updateTables, [walks])
  assert.deepEqual(updateSets, [{ state: 'failed' }])
})

test('failIfPresent resolves when no recording walk exists', async () => {
  const { database, calls, insertTables, updateTables } = createWalkDatabaseFake({ updateResult: [] })
  await createDrizzleWalkRepository(database).failIfPresent({ ownerId })
  assert.deepEqual(calls, ['update'])
  assert.deepEqual(insertTables, [])
  assert.deepEqual(updateTables, [walks])
})

test('fail marks the recording walk as failed', async () => {
  const { database, calls, updateTables, updateSets, updateWheres } = createWalkDatabaseFake({
    updateResult: [failedWalkRow],
  })
  await createDrizzleWalkRepository(database).fail(failInput)
  assert.deepEqual(calls, ['update'])
  assert.deepEqual(updateTables, [walks])
  assert.deepEqual(updateSets, [{ state: 'failed' }])
  assert.equal(updateWheres.length, 1)
  assert.equal(updateWhereGatesRecording(updateWheres[0]), true)
})

test('fail resolves when the walk is already failed', async () => {
  const { database, calls } = createWalkDatabaseFake({
    selectResults: [[failedWalkRow]],
    updateResult: [],
  })
  await createDrizzleWalkRepository(database).fail(failInput)
  assert.deepEqual(calls, ['update', 'select'])
})

test('fail throws WalkNotRecordingError when the walk is completed', async () => {
  const { database } = createWalkDatabaseFake({
    selectResults: [[completedWalkRow]],
    updateResult: [],
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).fail(failInput),
    isError(WalkNotRecordingError),
  )
})

test('fail throws WalkNotFoundError for another owner or unknown walkId', async () => {
  const { database } = createWalkDatabaseFake({
    selectResults: [[]],
    updateResult: [],
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).fail({ ownerId: otherOwnerId, walkId }),
    isError(WalkNotFoundError),
  )
})

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
