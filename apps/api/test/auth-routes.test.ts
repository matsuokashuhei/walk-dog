import assert from 'node:assert/strict'
import test from 'node:test'
import { registerAuthRoutes } from '../src/routes/auth.js'
import { createAuthApp, mockCognito, mockDb } from './auth-fixtures.js'

test('registerAuthRoutes adds every authentication endpoint to OpenAPI', async () => {
  const app = createAuthApp((application) => { registerAuthRoutes(application, mockDb(), mockCognito()) })
  const response = await app.request('/openapi.json')
  const document = await response.json() as { paths: Record<string, unknown> }

  assert.equal(response.status, 200)
  assert.ok('/v1/auth/sign-up' in document.paths)
  assert.ok('/v1/auth/sign-up/verify' in document.paths)
  assert.ok('/v1/auth/sign-in' in document.paths)
  assert.ok('/v1/auth/sign-in/verify' in document.paths)
})
