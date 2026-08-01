import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { setRequestIdTag } from '../src/observability/sentry.js'
import { testLogger } from './test-logger.js'

const appDependencies = {
  logger: testLogger,
  setRequestId: setRequestIdTag,
}

test('GET /health returns the API health state', async () => {
  const response = await createApp(appDependencies).request('/health')

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('GET /health generates a non-empty request ID when none is received', async () => {
  const response = await createApp(appDependencies).request('/health')

  assert.ok(response.headers.get('X-Request-Id'))
})

test('GET /openapi.json describes the health endpoint and error schema', async () => {
  const response = await createApp(appDependencies).request('/openapi.json')
  const document = await response.json() as {
    openapi: string
    paths: Record<string, {
      get?: {
        responses?: Record<string, {
          headers?: Record<string, unknown>
        }>
      }
    }>
    components: { schemas: Record<string, unknown> }
  }

  assert.equal(response.status, 200)
  assert.equal(document.openapi, '3.1.0')
  assert.ok('/health' in document.paths)
  assert.ok('Error' in document.components.schemas)
  assert.ok('X-Request-Id' in (document.paths['/health'].get?.responses?.['200'].headers ?? {}))
})

test('uses a received request ID for the health response', async () => {
  const response = await createApp(appDependencies).request('/health', {
    headers: { 'X-Request-Id': 'request-123' },
  })

  assert.equal(response.headers.get('X-Request-Id'), 'request-123')
})

test('returns the error contract for an unknown path', async () => {
  const response = await createApp(appDependencies).request('/missing', {
    headers: { 'X-Request-Id': 'request-404' },
  })
  const body = await response.json() as { requestId: string }

  assert.equal(response.status, 404)
  assert.deepEqual(body, {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    requestId: 'request-404',
    retryable: false,
  })
  assert.equal(response.headers.get('X-Request-Id'), body.requestId)
})

test('returns the error contract when a route throws', async () => {
  const response = await createApp(appDependencies, (app) => {
    app.get('/test-error', () => {
      throw new Error('expected test error')
    })
  }).request('/test-error', {
    headers: { 'X-Request-Id': 'request-500' },
  })
  const body = await response.json() as { requestId: string }

  assert.equal(response.status, 500)
  assert.deepEqual(body, {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
    requestId: 'request-500',
    retryable: false,
  })
  assert.equal(response.headers.get('X-Request-Id'), body.requestId)
})
