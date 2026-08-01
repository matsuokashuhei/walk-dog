import assert from 'node:assert/strict'
import test from 'node:test'
import type { Pool } from 'pg'
import { createShutdownHandler } from '../src/server.js'

test('closes the database pool after the HTTP server has stopped', async () => {
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
  )

  const shutdownPromise = shutdown()

  assert.deepEqual(calls, ['server closing'])

  completeClose?.()
  await shutdownPromise

  assert.deepEqual(calls, ['server closing', 'pool'])
})
