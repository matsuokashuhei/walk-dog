import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'

test('GET /health returns the API health state', async () => {
  const response = await createApp().request('/health')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('uses a received request ID for the health response', async () => {
  const response = await createApp().request('/health', {
    headers: { 'X-Request-Id': 'request-123' },
  })

  assert.equal(response.headers.get('X-Request-Id'), 'request-123')
})

test('returns the error contract for an unknown path', async () => {
  const response = await createApp().request('/missing', {
    headers: { 'X-Request-Id': 'request-404' },
  })

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    requestId: 'request-404',
    retryable: false,
  })
})

test('returns the error contract when a route throws', async () => {
  const response = await createApp((app) => {
    app.get('/test-error', () => {
      throw new Error('expected test error')
    })
  }).request('/test-error', {
    headers: { 'X-Request-Id': 'request-500' },
  })

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    requestId: 'request-500',
    retryable: false,
  })
})
