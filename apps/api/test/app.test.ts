import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'

test('GET /health returns the API health state', async () => {
  const response = await createApp().request('/health')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
