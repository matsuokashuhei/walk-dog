import assert from 'node:assert/strict'
import test from 'node:test'
import { OpenAPIHono } from '@hono/zod-openapi'
import { createAuthenticationMiddleware } from '../../../src/shared/http/authentication-middleware.js'
import type { AppVariables } from '../../../src/shared/http/types.js'

const unauthenticatedBody = {
  code: 'UNAUTHENTICATED',
  message: 'Authentication is required.',
  requestId: 'req-1',
  retryable: false,
}

function createProtectedApp(
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }>,
) {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', async (context, next) => {
    context.set('requestId', 'req-1')
    await next()
  })
  app.use('*', createAuthenticationMiddleware({ verify }))
  app.get('/protected', (context) => context.json({
    ok: true,
    cognitoSubject: context.get('principal').cognitoSubject,
  }))
  return app
}

test('returns 401 UNAUTHENTICATED when Authorization is missing', async () => {
  const app = new OpenAPIHono<{ Variables: AppVariables }>()
  app.use('*', async (context, next) => {
    context.set('requestId', 'req-1')
    await next()
  })
  app.use('*', createAuthenticationMiddleware({
    verify: async () => {
      throw new Error('should not verify')
    },
  }))
  app.get('/protected', (context) => context.json({ ok: true }))
  const response = await app.request('/protected')
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    code: 'UNAUTHENTICATED',
    message: 'Authentication is required.',
    requestId: 'req-1',
    retryable: false,
  })
})

test('returns 401 UNAUTHENTICATED when Authorization is not Bearer', async () => {
  const response = await createProtectedApp(async () => {
    throw new Error('should not verify')
  }).request('/protected', {
    headers: { Authorization: 'Basic credentials' },
  })
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), unauthenticatedBody)
})

test('returns 401 UNAUTHENTICATED when access token verification fails', async () => {
  const response = await createProtectedApp(async () => {
    throw new Error('invalid token')
  }).request('/protected', {
    headers: { Authorization: 'Bearer bad-token' },
  })
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), unauthenticatedBody)
})

test('sets principal and continues when access token verification succeeds', async () => {
  const response = await createProtectedApp(async (accessToken) => {
    assert.equal(accessToken, 'good-token')
    return { cognitoSubject: 'sub-1' }
  }).request('/protected', {
    headers: { Authorization: 'Bearer good-token' },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    cognitoSubject: 'sub-1',
  })
})
