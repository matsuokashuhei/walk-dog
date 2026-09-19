import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deleteWalkRoute,
  registerDeleteWalkRoute,
} from '../../../../src/modules/walks/routes/delete-walk.js'
import type { DeleteWalk } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(deleteWalkRoute.method, 'delete')
assert.equal(deleteWalkRoute.path, '/{walkId}')
assert.deepEqual(deleteWalkRoute.security, [{ BearerAuth: [] }])

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'

function createDeleteWalkApp(
  deleteWalk: DeleteWalk,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerDeleteWalkRoute(routeApp, deleteWalk)
  })
}

const authorizedHeaders = {
  Authorization: 'Bearer access',
  Accept: 'application/json',
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

test('DELETE /v1/walks/:walkId returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createDeleteWalkApp(async () => {
    calls.push('delete')
    return { ok: true }
  }, async () => {
    throw new Error('should not verify')
  }).request(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('DELETE /v1/walks/:walkId returns 204 with an empty body', async () => {
  const calls: Array<{ cognitoSubject: string; walkId: string }> = []
  const response = await createDeleteWalkApp(async (input) => {
    calls.push(input)
    return { ok: true }
  }).request(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    headers: authorizedHeaders,
  })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.deepEqual(calls, [{
    cognitoSubject: 'sub-1',
    walkId,
  }])
})

test('DELETE /v1/walks/:walkId returns 204 when the walk is already failed', async () => {
  const response = await createDeleteWalkApp(async () => ({ ok: true })).request(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    headers: authorizedHeaders,
  })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
})

test('DELETE /v1/walks/:walkId returns 404 NOT_FOUND when the walk is missing', async () => {
  const response = await createDeleteWalkApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    headers: authorizedHeaders,
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('DELETE /v1/walks/:walkId returns 404 NOT_FOUND for another owner walk', async () => {
  const response = await createDeleteWalkApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    headers: authorizedHeaders,
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('DELETE /v1/walks/:walkId returns 404 NOT_FOUND for a non-UUID walkId', async () => {
  const calls: string[] = []
  const response = await createDeleteWalkApp(async () => {
    calls.push('delete')
    throw new Error('deleteWalk should not run for a non-UUID walkId')
  }).request('/v1/walks/not-a-uuid', {
    method: 'DELETE',
    headers: authorizedHeaders,
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('DELETE /v1/walks/:walkId returns 409 WALK_NOT_RECORDING when the walk is completed', async () => {
  const response = await createDeleteWalkApp(async () => ({
    ok: false,
    error: 'walk_not_recording',
  })).request(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    headers: authorizedHeaders,
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(body.code, 'WALK_NOT_RECORDING')
  assert.equal(body.message, 'この散歩は破棄できません。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})
