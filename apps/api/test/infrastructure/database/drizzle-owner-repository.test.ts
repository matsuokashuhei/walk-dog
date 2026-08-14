import assert from 'node:assert/strict'
import test from 'node:test'
import type { DbInstance } from '../../../src/infrastructure/database/client.js'
import { createDrizzleOwnerRepository } from '../../../src/infrastructure/database/repositories/drizzle-owner-repository.js'
import { owners } from '../../../src/infrastructure/database/schema/owner.js'
import type { Owner } from '../../../src/modules/owners/index.js'

const createdAt = new Date('2026-08-02T15:23:48.068Z')
const updatedAt = new Date('2026-08-02T15:23:48.068Z')

const insertedRow = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  cognitoSubject: 'subject-1',
  displayName: null,
  createdAt,
  updatedAt,
}

const expectedOwner: Owner = {
  ownerId: insertedRow.ownerId,
  displayName: null,
  avatarUrl: null,
  createdAt,
  updatedAt,
}

function createDatabaseFake(options: {
  insertResult?: typeof insertedRow[]
  selectResult?: typeof insertedRow[]
  insertError?: Error
  updateResult?: typeof insertedRow[]
  updateError?: Error
}): {
  database: DbInstance
  calls: string[]
  insertValues: unknown[]
  onConflictConfigs: unknown[]
  updateSets: unknown[]
  updateTargets: unknown[]
} {
  const calls: string[] = []
  const insertValues: unknown[] = []
  const onConflictConfigs: unknown[] = []
  const updateSets: unknown[] = []
  const updateTargets: unknown[] = []
  const insertResult = options.insertResult ?? [insertedRow]
  const selectResult = options.selectResult ?? []
  const updateResult = options.updateResult ?? []

  const returning = async () => {
    if (options.insertError) {
      throw options.insertError
    }
    return insertResult
  }
  const onConflictDoNothing = (config?: unknown) => {
    onConflictConfigs.push(config)
    return { returning }
  }
  const values = (value: unknown) => {
    insertValues.push(value)
    calls.push('insert')
    return { onConflictDoNothing }
  }
  const insert = () => ({ values })

  const limit = async () => {
    calls.push('select')
    return selectResult
  }
  const where = () => ({ limit })
  const from = () => ({ where })
  const select = () => ({ from })

  const updateWhere = (target: unknown) => {
    updateTargets.push(target)
    return {
      returning: async () => {
        if (options.updateError) {
          throw options.updateError
        }
        return updateResult
      },
    }
  }
  const set = (value: unknown) => {
    updateSets.push(value)
    return { where: updateWhere }
  }
  const update = () => {
    calls.push('update')
    return { set }
  }

  const transaction = async (callback: (trx: { insert: typeof insert; select: typeof select }) => Promise<unknown>) => {
    calls.push('transaction')
    return callback({ insert, select })
  }

  return {
    database: { transaction, update } as unknown as DbInstance,
    calls,
    insertValues,
    onConflictConfigs,
    updateSets,
    updateTargets,
  }
}

test('resolveByCognitoSubject returns the inserted owner', async () => {
  const { database, calls, insertValues, onConflictConfigs } = createDatabaseFake({ insertResult: [insertedRow] })
  const repository = createDrizzleOwnerRepository(database)

  assert.deepEqual(await repository.resolveByCognitoSubject('subject-1'), expectedOwner)
  assert.deepEqual(calls, ['transaction', 'insert'])
  assert.deepEqual(insertValues, [{ cognitoSubject: 'subject-1', displayName: null }])
  assert.deepEqual(onConflictConfigs, [{ target: owners.cognitoSubject }])
})

test('resolveByCognitoSubject selects the existing owner on conflict', async () => {
  const { database, calls, insertValues, onConflictConfigs } = createDatabaseFake({
    insertResult: [],
    selectResult: [insertedRow],
  })
  const repository = createDrizzleOwnerRepository(database)

  assert.deepEqual(await repository.resolveByCognitoSubject('subject-1'), expectedOwner)
  assert.deepEqual(calls, ['transaction', 'insert', 'select'])
  assert.deepEqual(insertValues, [{ cognitoSubject: 'subject-1', displayName: null }])
  assert.deepEqual(onConflictConfigs, [{ target: owners.cognitoSubject }])
})

test('resolveByCognitoSubject maps nullable displayName and avatarUrl', async () => {
  const row = {
    ...insertedRow,
    displayName: null,
  }
  const { database } = createDatabaseFake({ insertResult: [row] })
  const repository = createDrizzleOwnerRepository(database)

  assert.deepEqual(await repository.resolveByCognitoSubject('subject-1'), {
    ownerId: row.ownerId,
    displayName: null,
    avatarUrl: null,
    createdAt,
    updatedAt,
  })
})

test('resolveByCognitoSubject propagates unexpected query errors by identity', async () => {
  const unexpected = new Error('query failed')
  const { database } = createDatabaseFake({ insertError: unexpected })
  const repository = createDrizzleOwnerRepository(database)

  await assert.rejects(
    () => repository.resolveByCognitoSubject('subject-1'),
    (error: unknown) => error === unexpected,
  )
})

test('updateDisplayName returns the updated owner', async () => {
  const updatedRow = {
    ...insertedRow,
    displayName: 'Akira',
    updatedAt: new Date('2026-08-14T06:40:11.000Z'),
  }
  const { database, updateSets, updateTargets } = createDatabaseFake({
    updateResult: [updatedRow],
  })
  const repository = createDrizzleOwnerRepository(database)

  assert.deepEqual(await repository.updateDisplayName('subject-1', 'Akira'), {
    ownerId: updatedRow.ownerId,
    displayName: 'Akira',
    avatarUrl: null,
    createdAt,
    updatedAt: updatedRow.updatedAt,
  })
  assert.deepEqual(updateSets, [{ displayName: 'Akira' }])
  assert.equal(updateTargets.length, 1)
})

test('updateDisplayName propagates unexpected query errors by identity', async () => {
  const unexpected = new Error('update failed')
  const { database } = createDatabaseFake({ updateError: unexpected })
  const repository = createDrizzleOwnerRepository(database)

  await assert.rejects(
    () => repository.updateDisplayName('subject-1', 'Akira'),
    (error: unknown) => error === unexpected,
  )
})
