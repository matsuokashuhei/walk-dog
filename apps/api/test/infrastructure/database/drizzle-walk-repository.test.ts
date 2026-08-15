import assert from 'node:assert/strict'
import test from 'node:test'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import type { DbInstance } from '../../../src/infrastructure/database/client.js'
import { createDrizzleWalkRepository } from '../../../src/infrastructure/database/repositories/drizzle-walk-repository.js'
import { dogs } from '../../../src/infrastructure/database/schema/dog.js'
import { walkCommandKeys } from '../../../src/infrastructure/database/schema/walk-command-key.js'
import { walkParticipants } from '../../../src/infrastructure/database/schema/walk-participant.js'
import { walks } from '../../../src/infrastructure/database/schema/walk.js'
import {
  ActiveWalkExistsError,
  IdempotencyConflictError,
  WalkNotFoundError,
  WalkNotRecordingError,
} from '../../../src/modules/walks/errors.js'

const startedAt = new Date('2026-08-15T12:00:00.000Z')
const completedAt = new Date('2026-08-15T12:10:30.500Z')
const ownerId = '019fc312-f7eb-73c4-9351-2a6ea25e4fcb'
const otherOwnerId = '019fc312-f7eb-73c4-9351-2a6ea25e4fcc'
const walkId = '019fc320-aaaa-73c4-9351-2a6ea25e4f01'
const dogId1 = '019fc313-aaaa-73c4-9351-2a6ea25e4f01'
const dogId2 = '019fc313-cccc-73c4-9351-2a6ea25e4f03'
const startKey = 'idem-start-1'
const finishKey = 'idem-finish-1'
const startHash = 'hash-start-1'
const finishHash = 'hash-finish-1'

const recordingWalkRow = {
  walkId, ownerId, state: 'recording' as const, startedAt, completedAt: null, createdAt: startedAt, updatedAt: startedAt,
}
const completedWalkRow = {
  walkId, ownerId, state: 'completed' as const, startedAt, completedAt, createdAt: startedAt, updatedAt: completedAt,
}
const participantRow1 = {
  walkParticipantId: '019fc321-aaaa-73c4-9351-2a6ea25e4f01', walkId, dogId: dogId1, name: 'Mugi', position: 0, createdAt: startedAt,
}
const participantRow2 = {
  walkParticipantId: '019fc321-bbbb-73c4-9351-2a6ea25e4f02', walkId, dogId: dogId2, name: 'Sora', position: 1, createdAt: startedAt,
}
const expectedParticipants = [
  { walkParticipantId: participantRow1.walkParticipantId, dogId: dogId1, name: 'Mugi' },
  { walkParticipantId: participantRow2.walkParticipantId, dogId: dogId2, name: 'Sora' },
]
const expectedRecordingWalk = {
  walkId, ownerId, state: 'recording' as const, startedAt, completedAt: null, participants: expectedParticipants,
}
const expectedCompletedWalk = {
  walkId, ownerId, state: 'completed' as const, startedAt, completedAt,
  durationSeconds: 630, distanceMeters: 0 as const, paceSecondsPerMeter: null, participants: expectedParticipants,
}
const startInput = { ownerId, participantDogIds: [dogId1, dogId2], idempotencyKey: startKey, bodyHash: startHash }
const finishInput = { ownerId, walkId, idempotencyKey: finishKey, bodyHash: finishHash }
const ownedDogs = [{ dogId: dogId1, name: 'Mugi' }, { dogId: dogId2, name: 'Sora' }]
const startCommandKeyRow = {
  walkCommandKeyId: '019fc322-aaaa-73c4-9351-2a6ea25e4f01',
  ownerId, namespace: 'start' as const, key: startKey, bodyHash: startHash, walkId, createdAt: startedAt,
}
const finishCommandKeyRow = {
  walkCommandKeyId: '019fc322-bbbb-73c4-9351-2a6ea25e4f02',
  ownerId, namespace: 'finish' as const, key: finishKey, bodyHash: finishHash, walkId, createdAt: startedAt,
}

function createDatabaseFake(options: {
  selectResults?: unknown[][]
  insertResults?: unknown[][]
  updateResult?: unknown[]
  insertError?: Error
  insertErrorAtIndex?: number
}) {
  const calls: string[] = []
  const insertTables: unknown[] = []
  const insertValues: unknown[] = []
  const selectTables: unknown[] = []
  const updateTables: unknown[] = []
  const updateSets: unknown[] = []
  const selectResults = options.selectResults ?? []
  const insertResults = options.insertResults ?? []
  const updateResult = options.updateResult ?? []
  let selectCallIndex = 0
  let insertCallIndex = 0

  const createSelectQuery = () => {
    const execute = async () => {
      calls.push('select')
      const result = selectResults[selectCallIndex] ?? []
      selectCallIndex += 1
      return result
    }
    const query = {
      from: (table: unknown) => {
        selectTables.push(table)
        return query
      },
      where: () => query,
      orderBy: () => {
        calls.push('orderBy')
        return query
      },
      then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
        execute().then(onFulfilled, onRejected),
    }
    return query
  }
  const values = (value: unknown) => {
    insertValues.push(value)
    calls.push('insert')
    return {
      returning: async () => {
        if (options.insertError && insertCallIndex === (options.insertErrorAtIndex ?? 0)) {
          throw options.insertError
        }
        const result = insertResults[insertCallIndex] ?? []
        insertCallIndex += 1
        return result
      },
    }
  }
  const updateWhere = () => {
    const execute = async () => updateResult
    return {
      returning: execute,
      then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
        execute().then(onFulfilled, onRejected),
    }
  }
  const ops = {
    select: () => createSelectQuery(),
    insert: (table: unknown) => {
      insertTables.push(table)
      return { values }
    },
    update: (table: unknown) => {
      updateTables.push(table)
      calls.push('update')
      return {
        set: (value: unknown) => {
          updateSets.push(value)
          return { where: updateWhere }
        },
      }
    },
  }
  const transaction = async (callback: (trx: typeof ops) => Promise<unknown>) => {
    calls.push('transaction')
    return callback(ops)
  }
  return {
    database: { transaction, select: ops.select, update: ops.update, insert: ops.insert } as unknown as DbInstance,
    calls, insertTables, insertValues, selectTables, updateTables, updateSets,
  }
}

const uniqueViolation = (constraint: string) =>
  new DrizzleQueryError('insert', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }))
const commandKeyUnique = uniqueViolation('walk_command_keys_owner_id_namespace_key_unique')


test('getActiveByOwner returns the recording walk with participants in position order', async () => {
  const { database, calls } = createDatabaseFake({
    selectResults: [[recordingWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).getActiveByOwner(ownerId), expectedRecordingWalk)
  assert.deepEqual(calls, ['select', 'orderBy', 'select'])
})

test('getActiveByOwner returns null when no recording walk exists', async () => {
  const { database, calls } = createDatabaseFake({ selectResults: [[]] })
  assert.equal(await createDrizzleWalkRepository(database).getActiveByOwner(ownerId), null)
  assert.deepEqual(calls, ['select'])
})

test('start inserts a recording walk, request-order participants, and a start command key', async () => {
  const { database, calls, insertTables, insertValues, selectTables } = createDatabaseFake({
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
  const { database, calls, insertTables } = createDatabaseFake({
    selectResults: [[startCommandKeyRow], [recordingWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).start(startInput), expectedRecordingWalk)
  assert.deepEqual(calls, ['transaction', 'select', 'select', 'orderBy', 'select'])
  assert.deepEqual(insertTables, [])
})

test('start throws IdempotencyConflictError when the start key matches with a different body hash', async () => {
  const { database } = createDatabaseFake({ selectResults: [[{ ...startCommandKeyRow, bodyHash: 'other-hash' }]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).start(startInput),
    (error: unknown) => error instanceof IdempotencyConflictError,
  )
})

test('start throws ActiveWalkExistsError on recording unique violation', async () => {
  const { database } = createDatabaseFake({
    selectResults: [[], ownedDogs],
    insertError: uniqueViolation('walks_owner_id_recording_unique'),
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).start(startInput),
    (error: unknown) => error instanceof ActiveWalkExistsError,
  )
})

test('start replays the original walk when command-key unique violates with the same hash', async () => {
  const { database } = createDatabaseFake({
    selectResults: [[], ownedDogs, [startCommandKeyRow], [recordingWalkRow], [participantRow1, participantRow2]],
    insertResults: [[recordingWalkRow], [participantRow1, participantRow2]],
    insertError: commandKeyUnique, insertErrorAtIndex: 2,
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).start(startInput), expectedRecordingWalk)
})


test('start throws IdempotencyConflictError when command-key unique violates with a different hash', async () => {
  const { database } = createDatabaseFake({
    selectResults: [[], ownedDogs, [{ ...startCommandKeyRow, bodyHash: 'other-hash' }]],
    insertResults: [[recordingWalkRow], [participantRow1, participantRow2]],
    insertError: commandKeyUnique, insertErrorAtIndex: 2,
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).start(startInput),
    (error: unknown) => error instanceof IdempotencyConflictError,
  )
})

test('start throws WalkNotFoundError when a participant dog is missing or not owned', async () => {
  const { database, insertTables } = createDatabaseFake({
    selectResults: [[], [{ dogId: dogId1, name: 'Mugi' }]],
  })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).start(startInput),
    (error: unknown) => error instanceof WalkNotFoundError,
  )
  assert.deepEqual(insertTables, [])
})

test('finish completes the recording walk and stores a finish command key', async () => {
  const { database, calls, insertTables, insertValues, updateTables, updateSets } = createDatabaseFake({
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
  const { database, calls, insertTables, updateTables } = createDatabaseFake({
    selectResults: [[finishCommandKeyRow], [completedWalkRow], [participantRow1, participantRow2]],
  })
  assert.deepEqual(await createDrizzleWalkRepository(database).finish(finishInput), expectedCompletedWalk)
  assert.deepEqual(calls, ['transaction', 'select', 'select', 'orderBy', 'select'])
  assert.deepEqual(insertTables, [])
  assert.deepEqual(updateTables, [])
})

test('finish throws IdempotencyConflictError when the finish key matches with a different body hash', async () => {
  const { database } = createDatabaseFake({ selectResults: [[{ ...finishCommandKeyRow, bodyHash: 'other-hash' }]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).finish(finishInput),
    (error: unknown) => error instanceof IdempotencyConflictError,
  )
})

test('finish throws WalkNotFoundError for another owner or unknown walkId', async () => {
  const { database } = createDatabaseFake({ selectResults: [[], []] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).finish({ ...finishInput, ownerId: otherOwnerId }),
    (error: unknown) => error instanceof WalkNotFoundError,
  )
})

test('finish throws WalkNotRecordingError when the walk is not recording', async () => {
  const { database } = createDatabaseFake({ selectResults: [[], [completedWalkRow]] })
  await assert.rejects(
    () => createDrizzleWalkRepository(database).finish(finishInput),
    (error: unknown) => error instanceof WalkNotRecordingError,
  )
})

test('failIfPresent marks the recording walk as failed', async () => {
  const { database, calls, updateTables, updateSets } = createDatabaseFake({
    updateResult: [{ ...recordingWalkRow, state: 'failed' }],
  })
  await createDrizzleWalkRepository(database).failIfPresent({ ownerId })
  assert.deepEqual(calls, ['update'])
  assert.deepEqual(updateTables, [walks])
  assert.deepEqual(updateSets, [{ state: 'failed' }])
})

test('failIfPresent resolves when no recording walk exists', async () => {
  const { database, calls, insertTables, updateTables } = createDatabaseFake({ updateResult: [] })
  await createDrizzleWalkRepository(database).failIfPresent({ ownerId })
  assert.deepEqual(calls, ['update'])
  assert.deepEqual(insertTables, [])
  assert.deepEqual(updateTables, [walks])
})
