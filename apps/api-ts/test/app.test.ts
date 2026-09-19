import assert from 'node:assert/strict'
import test from 'node:test'
import { OpenAPIHono } from '@hono/zod-openapi'
import { createApp } from '../src/app.js'
import { healthRoute, registerHealthRoutes } from '../src/modules/health/index.js'
import { setRequestIdTag } from '../src/infrastructure/observability/sentry.js'
import type { AppVariables } from '../src/shared/http/types.js'
import { registerHealthyHealthRoutes } from './support/health-routes.js'
import { testLogger } from './support/test-logger.js'

const appDependencies = {
  logger: testLogger,
  setRequestId: setRequestIdTag,
}

const withHealth = () => createApp(appDependencies, [
  { path: '/', app: registerHealthyHealthRoutes() },
])

test('registerHealthRoutes serves GET /health', async () => {
  assert.equal(healthRoute.method, 'get')
  assert.equal(healthRoute.path, '/health')
  const routes = registerHealthyHealthRoutes()
  const response = await routes.request('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('GET /health returns 200 when API, worker, and postgres are up', async () => {
  const app = createApp(appDependencies, [{
    path: '/',
    app: registerHealthRoutes({ checkHealth: async () => ({ ok: true }) }),
  }])
  const response = await app.request('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('GET /health returns 503 DEPENDENCY_UNAVAILABLE when a dependency is down', async () => {
  const app = createApp(appDependencies, [{
    path: '/',
    app: registerHealthRoutes({ checkHealth: async () => ({ ok: false }) }),
  }])
  const response = await app.request('/health', { headers: { 'X-Request-Id': 'health-1' } })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'A required dependency is unavailable.',
    requestId: 'health-1',
    retryable: true,
  })
})

test('GET /health generates a non-empty request ID when none is received', async () => {
  const response = await withHealth().request('/health')

  assert.ok(response.headers.get('X-Request-Id'))
})

test('GET /openapi.json describes the health endpoint and error schema', async () => {
  const response = await withHealth().request('/openapi.json')
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
  const response = await withHealth().request('/health', {
    headers: { 'X-Request-Id': 'request-123' },
  })

  assert.equal(response.headers.get('X-Request-Id'), 'request-123')
})

test('returns the error contract for an unknown path', async () => {
  const response = await withHealth().request('/missing', {
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
  const errorChild = new OpenAPIHono<{ Variables: AppVariables }>()
  errorChild.get('/test-error', () => {
    throw new Error('expected test error')
  })
  const response = await createApp(appDependencies, [
    { path: '/', app: registerHealthyHealthRoutes() },
    { path: '/', app: errorChild },
  ]).request('/test-error', {
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
