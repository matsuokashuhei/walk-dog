import assert from 'node:assert/strict'
import test from 'node:test'
import type { Pool } from 'pg'
import { createShutdownHandler } from '../src/server.js'

test('stops the HTTP server before closing the database pool', async () => {
  const calls: string[] = []
  const shutdown = createShutdownHandler(
    { close: () => calls.push('server') },
    { end: async () => { calls.push('pool') } } as Pool,
  )

  await shutdown()

  assert.deepEqual(calls, ['server', 'pool'])
})
