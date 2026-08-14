import assert from 'node:assert/strict'
import test from 'node:test'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import type { DbInstance } from '../../../src/infrastructure/database/client.js'
import { createDrizzleDogRepository } from '../../../src/infrastructure/database/repositories/drizzle-dog-repository.js'
import { dogs } from '../../../src/infrastructure/database/schema/dog.js'
import { goalRevisions } from '../../../src/infrastructure/database/schema/goal-revision.js'
import { DogNameDuplicateError } from '../../../src/modules/dogs/errors.js'
import type { CreateDogInput, Dog } from '../../../src/modules/dogs/types.js'

const createdAt = new Date('2026-08-14T13:00:00.000Z')
const updatedAt = new Date('2026-08-14T13:00:00.000Z')
const ownerId = '019fc312-f7eb-73c4-9351-2a6ea25e4fcb'
const dogId = '019fc313-aaaa-73c4-9351-2a6ea25e4f01'
const goalRevisionId = '019fc313-bbbb-73c4-9351-2a6ea25e4f02'

const input: CreateDogInput = {
  name: 'Mugi',
  gender: 'male',
  birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
}

const insertedDog = {
  dogId,
  ownerId,
  name: 'Mugi',
  gender: 'male' as const,
  birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
  createdAt,
  updatedAt,
}

const insertedRevision = {
  goalRevisionId,
  dogId,
  period: 'daily' as const,
  minutes: 30,
  effectiveFrom: createdAt,
  effectiveTo: null,
  createdAt,
}

const expectedDog: Dog = {
  dogId,
  ownerId,
  name: 'Mugi',
  gender: 'male',
  birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
  avatarUrl: null,
  createdAt,
  updatedAt,
  currentGoal: {
    goalRevisionId,
    period: 'daily',
    minutes: 30,
    effectiveFrom: createdAt,
    effectiveTo: null,
  },
}

const joinedRow = {
  dog: insertedDog,
  revision: insertedRevision,
}

function createDatabaseFake(options: {
  insertResults?: unknown[][]
  insertError?: Error
  selectResult?: typeof joinedRow[]
  selectError?: Error
}): {
  database: DbInstance
  calls: string[]
  insertTables: unknown[]
  insertValues: unknown[]
} {
  const calls: string[] = []
  const insertTables: unknown[] = []
  const insertValues: unknown[] = []
  const insertResults = options.insertResults ?? [[insertedDog], [insertedRevision]]
  const selectResult = options.selectResult ?? []
  let insertCallIndex = 0

  const values = (value: unknown) => {
    insertValues.push(value)
    calls.push('insert')
    return {
      returning: async () => {
        if (options.insertError) {
          throw options.insertError
        }
        const result = insertResults[insertCallIndex] ?? []
        insertCallIndex += 1
        return result
      },
    }
  }
  const insert = (table: unknown) => {
    insertTables.push(table)
    return { values }
  }

  const where = async () => {
    calls.push('select')
    if (options.selectError) {
      throw options.selectError
    }
    return selectResult
  }
  const innerJoin = () => ({ where })
  const from = () => ({ innerJoin })
  const select = () => ({ from })

  const transaction = async (callback: (trx: { insert: typeof insert }) => Promise<unknown>) => {
    calls.push('transaction')
    return callback({ insert })
  }

  return {
    database: { transaction, select } as unknown as DbInstance,
    calls,
    insertTables,
    insertValues,
  }
}

test('createWithDailyGoal returns the dog with a daily 30-minute current goal', async () => {
  const { database, calls, insertTables, insertValues } = createDatabaseFake({
    insertResults: [[insertedDog], [insertedRevision]],
  })
  const repository = createDrizzleDogRepository(database)

  assert.deepEqual(await repository.createWithDailyGoal(ownerId, input), expectedDog)
  assert.deepEqual(calls, ['transaction', 'insert', 'insert'])
  assert.deepEqual(insertTables, [dogs, goalRevisions])
  assert.deepEqual(insertValues, [
    {
      ownerId,
      name: 'Mugi',
      gender: 'male',
      birthday: { precision: 'day', year: 2020, month: 4, day: 12 },
    },
    {
      dogId,
      period: 'daily',
      minutes: 30,
      effectiveFrom: createdAt,
      effectiveTo: null,
    },
  ])
})

test('createWithDailyGoal throws DogNameDuplicateError on unique violation', async () => {
  const pgError = Object.assign(new Error('duplicate key'), { code: '23505' })
  const uniqueViolation = new DrizzleQueryError('insert into "dogs"', [], pgError)
  const { database } = createDatabaseFake({ insertError: uniqueViolation })
  const repository = createDrizzleDogRepository(database)

  await assert.rejects(
    () => repository.createWithDailyGoal(ownerId, input),
    (error: unknown) => error instanceof DogNameDuplicateError,
  )
})

test('createWithDailyGoal propagates unexpected query errors by identity', async () => {
  const unexpected = new Error('query failed')
  const { database } = createDatabaseFake({ insertError: unexpected })
  const repository = createDrizzleDogRepository(database)

  await assert.rejects(
    () => repository.createWithDailyGoal(ownerId, input),
    (error: unknown) => error === unexpected,
  )
})

test('listByOwner returns dogs with their current goal', async () => {
  const { database, calls } = createDatabaseFake({ selectResult: [joinedRow] })
  const repository = createDrizzleDogRepository(database)

  assert.deepEqual(await repository.listByOwner(ownerId), [expectedDog])
  assert.deepEqual(calls, ['select'])
})

test('getByOwnerAndId returns the dog when owner and id match', async () => {
  const { database, calls } = createDatabaseFake({ selectResult: [joinedRow] })
  const repository = createDrizzleDogRepository(database)

  assert.deepEqual(await repository.getByOwnerAndId(ownerId, dogId), expectedDog)
  assert.deepEqual(calls, ['select'])
})

test('getByOwnerAndId returns null when owner and id do not match', async () => {
  const { database } = createDatabaseFake({ selectResult: [] })
  const repository = createDrizzleDogRepository(database)

  assert.equal(await repository.getByOwnerAndId(ownerId, dogId), null)
})

test('listByOwner propagates unexpected query errors by identity', async () => {
  const unexpected = new Error('select failed')
  const { database } = createDatabaseFake({ selectError: unexpected })
  const repository = createDrizzleDogRepository(database)

  await assert.rejects(
    () => repository.listByOwner(ownerId),
    (error: unknown) => error === unexpected,
  )
})
