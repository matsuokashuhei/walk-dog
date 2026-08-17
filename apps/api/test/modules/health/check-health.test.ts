import assert from 'node:assert/strict'
import test from 'node:test'
import { createCheckHealth } from '../../../src/modules/health/use-cases/check-health.js'

test('checkHealth is ok when postgres and worker succeed', async () => {
  const check = createCheckHealth({
    pingPostgres: async () => {},
    pingWorker: async () => {},
  })
  assert.deepEqual(await check(), { ok: true })
})

test('checkHealth is not ok when worker ping throws', async () => {
  const check = createCheckHealth({
    pingPostgres: async () => {},
    pingWorker: async () => { throw new Error('down') },
  })
  assert.deepEqual(await check(), { ok: false })
})

test('checkHealth is not ok when postgres ping throws', async () => {
  const check = createCheckHealth({
    pingPostgres: async () => { throw new Error('postgres down') },
    pingWorker: async () => {},
  })
  assert.deepEqual(await check(), { ok: false })
})
