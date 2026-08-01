import assert from 'node:assert/strict'
import test from 'node:test'
import type { Pool } from 'pg'
import { createShutdownHandler } from '../src/server.js'

test('closes the database pool and Sentry after the HTTP server has stopped', async () => {
  const calls: string[] = []
  let completeClose: (() => void) | undefined
  const shutdown = createShutdownHandler(
    {
      close: (callback?: (error?: Error) => void) => {
        calls.push('server closing')
        completeClose = () => callback?.()
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { close: async () => { calls.push('sentry') } },
  )

  const shutdownPromise = shutdown()

  assert.deepEqual(calls, ['server closing'])

  completeClose?.()
  await shutdownPromise

  assert.deepEqual(calls, ['server closing', 'pool', 'sentry'])
})

test('closes the database pool and Sentry when stopping the HTTP server fails', async () => {
  const calls: string[] = []
  const serverError = new Error('server close failed')
  const shutdown = createShutdownHandler(
    {
      close: (callback) => {
        calls.push('server closing')
        callback(serverError)
      },
    },
    { end: async () => { calls.push('pool') } } as Pool,
    { close: async () => { calls.push('sentry') } },
  )

  await assert.rejects(shutdown(), (error) => error === serverError)

  assert.deepEqual(calls, ['server closing', 'pool', 'sentry'])
})
