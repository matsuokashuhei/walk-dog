import { DrizzleQueryError } from 'drizzle-orm/errors'
import type { DbInstance } from '../../../src/infrastructure/database/client.js'

export function createWalkDatabaseFake(options: {
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
  const updateWheres: unknown[] = []
  const selectResults = options.selectResults ?? []
  const insertResults = options.insertResults ?? []
  const updateResult = options.updateResult ?? []
  let selectCallIndex = 0
  let insertCallIndex = 0

  const promiseLike = (execute: () => Promise<unknown>) => ({
    returning: execute,
    then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
      execute().then(onFulfilled, onRejected),
  })
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
  const updateWhere = (where: unknown) => {
    updateWheres.push(where)
    return promiseLike(async () => updateResult)
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
    calls,
    insertTables,
    insertValues,
    selectTables,
    updateTables,
    updateSets,
    updateWheres,
  }
}

function sqlTreeIncludes(node: unknown, match: (value: Record<string, unknown>) => boolean): boolean {
  if (node == null || typeof node !== 'object') return false
  const record = node as Record<string, unknown>
  const chunks = Array.isArray(node) ? node : record.queryChunks
  return match(record) || (Array.isArray(chunks) && chunks.some((chunk) => sqlTreeIncludes(chunk, match)))
}

export function updateWhereGatesRecording(where: unknown): boolean {
  return sqlTreeIncludes(where, (value) => value.name === 'state')
    && sqlTreeIncludes(where, (value) => value.value === 'recording' && 'encoder' in value)
}

export const isError = (ErrorType: new () => Error) => (error: unknown) => error instanceof ErrorType

export const uniqueViolation = (constraint: string) =>
  new DrizzleQueryError('insert', [], Object.assign(new Error('duplicate key'), { code: '23505', constraint }))
