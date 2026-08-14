import assert from 'node:assert/strict'
import test from 'node:test'
import { getOwnerRoute, registerGetOwnerRoute } from '../../../../src/modules/owners/routes/get-owner.js'
import type { GetOwner } from '../../../../src/modules/owners/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createOwnerApp } from '../fixtures.js'

assert.equal(getOwnerRoute.method, 'get')
assert.equal(getOwnerRoute.path, '/')
assert.deepEqual(getOwnerRoute.security, [{ BearerAuth: [] }])

const owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: null,
  avatarUrl: null,
  createdAt: new Date('2026-08-14T06:12:03.000Z'),
  updatedAt: new Date('2026-08-14T06:12:03.000Z'),
}

function createGetOwnerApp(
  getOwner: GetOwner,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createOwnerApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerGetOwnerRoute(routeApp, getOwner)
  })
}

test('GET /v1/owner returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createGetOwnerApp(async () => {
    calls.push('getOwner')
    return owner
  }, async () => {
    throw new Error('should not verify')
  }).request('/v1/owner', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const body = await response.json() as { code: string; retryable: boolean }
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('GET /v1/owner returns 200 owner', async () => {
  const calls: string[] = []
  const response = await createGetOwnerApp(async (cognitoSubject) => {
    calls.push(cognitoSubject)
    return owner
  }).request('/v1/owner', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as {
    ownerId: string
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
    requestId: string
  }
  assert.equal(response.status, 200)
  assert.equal(body.ownerId, owner.ownerId)
  assert.equal(body.displayName, null)
  assert.equal(body.avatarUrl, null)
  assert.equal(body.createdAt, owner.createdAt.toISOString())
  assert.equal(body.updatedAt, owner.updatedAt.toISOString())
  assert.ok(body.requestId)
  assert.deepEqual(calls, ['sub-1'])
})
