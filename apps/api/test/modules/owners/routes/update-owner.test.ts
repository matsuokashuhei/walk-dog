import assert from 'node:assert/strict'
import test from 'node:test'
import { registerUpdateOwnerRoute, updateOwnerRoute } from '../../../../src/modules/owners/routes/update-owner.js'
import type { UpdateOwnerDisplayName } from '../../../../src/modules/owners/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createOwnerApp } from '../fixtures.js'

assert.equal(updateOwnerRoute.method, 'patch')
assert.equal(updateOwnerRoute.path, '/')
assert.deepEqual(updateOwnerRoute.security, [{ BearerAuth: [] }])

const owner = {
  ownerId: '019fc312-f7eb-73c4-9351-2a6ea25e4fcb',
  displayName: 'Akira',
  avatarUrl: null,
  createdAt: new Date('2026-08-14T06:12:03.000Z'),
  updatedAt: new Date('2026-08-14T06:40:11.000Z'),
}

function createUpdateOwnerApp(
  updateOwnerDisplayName: UpdateOwnerDisplayName,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createOwnerApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerUpdateOwnerRoute(routeApp, updateOwnerDisplayName)
  })
}

const authorizedHeaders = {
  Authorization: 'Bearer access',
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

test('PATCH /v1/owner returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createUpdateOwnerApp(async () => {
    calls.push('update')
    return owner
  }, async () => {
    throw new Error('should not verify')
  }).request('/v1/owner', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ displayName: 'Akira' }),
  })
  assert.equal(response.status, 401)
  assert.equal((await response.json() as { code: string }).code, 'UNAUTHENTICATED')
  assert.deepEqual(calls, [])
})

test('PATCH /v1/owner returns 400 for empty displayName', async () => {
  const calls: string[] = []
  const response = await createUpdateOwnerApp(async () => {
    calls.push('update')
    return owner
  }).request('/v1/owner', {
    method: 'PATCH',
    headers: authorizedHeaders,
    body: JSON.stringify({ displayName: '   ' }),
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT')
  assert.deepEqual(calls, [])
})

test('PATCH /v1/owner returns 200 with trimmed displayName', async () => {
  const calls: Array<{ cognitoSubject: string; displayName: string }> = []
  const response = await createUpdateOwnerApp(async (input) => {
    calls.push(input)
    return { ...owner, displayName: input.displayName }
  }).request('/v1/owner', {
    method: 'PATCH',
    headers: authorizedHeaders,
    body: JSON.stringify({ displayName: '  Akira  ' }),
  })
  const body = await response.json() as { displayName: string; ownerId: string }
  assert.equal(response.status, 200)
  assert.equal(body.displayName, 'Akira')
  assert.equal(body.ownerId, owner.ownerId)
  assert.deepEqual(calls, [{ cognitoSubject: 'sub-1', displayName: 'Akira' }])
})
