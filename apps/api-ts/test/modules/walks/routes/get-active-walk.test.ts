import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getActiveWalkRoute,
  registerGetActiveWalkRoute,
} from '../../../../src/modules/walks/routes/get-active-walk.js'
import type { GetActiveWalk, RecordingWalk } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(getActiveWalkRoute.method, 'get')
assert.equal(getActiveWalkRoute.path, '/active')
assert.deepEqual(getActiveWalkRoute.security, [{ BearerAuth: [] }])

const walk: RecordingWalk = {
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  ownerId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e6f',
  state: 'recording',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      name: 'Mugi',
    },
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e82',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e72',
      name: 'Sora',
    },
  ],
}

function createGetActiveWalkApp(
  getActiveWalk: GetActiveWalk,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerGetActiveWalkRoute(routeApp, getActiveWalk)
  })
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

test('GET /v1/walks/active returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createGetActiveWalkApp(async () => {
    calls.push('getActiveWalk')
    return walk
  }, async () => {
    throw new Error('should not verify')
  }).request('/v1/walks/active', {
    method: 'GET',
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

test('GET /v1/walks/active returns 200 recording walk', async () => {
  const calls: string[] = []
  const response = await createGetActiveWalkApp(async (cognitoSubject) => {
    calls.push(cognitoSubject)
    return walk
  }).request('/v1/walks/active', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  const body = await response.json() as {
    requestId: string
    walkId: string
    ownerId: string
    state: string
    startedAt: string
    completedAt: string | null
    participants: Array<{ walkParticipantId: string; dogId: string; name: string }>
  }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.walkId, walk.walkId)
  assert.equal(body.ownerId, walk.ownerId)
  assert.equal(body.state, 'recording')
  assert.equal(body.startedAt, '2026-08-15T03:12:04.000Z')
  assert.equal(body.completedAt, null)
  assert.deepEqual(body.participants, walk.participants)
  assert.deepEqual(calls, ['sub-1'])
})

test('GET /v1/walks/active returns 204 with an empty body when there is no recording walk', async () => {
  const response = await createGetActiveWalkApp(async () => null).request('/v1/walks/active', {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer access' },
  })
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
})
