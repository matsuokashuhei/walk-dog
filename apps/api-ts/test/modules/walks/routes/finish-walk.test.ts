import assert from 'node:assert/strict'
import test from 'node:test'
import {
  finishWalkRoute,
  registerFinishWalkRoute,
} from '../../../../src/modules/walks/routes/finish-walk.js'
import type { CompletedWalk, FinishWalk } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(finishWalkRoute.method, 'post')
assert.equal(finishWalkRoute.path, '/{walkId}/finish')
assert.deepEqual(finishWalkRoute.security, [{ BearerAuth: [] }])

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const idempotencyKey = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e91'

const walk: CompletedWalk = {
  walkId,
  ownerId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e6f',
  state: 'completed',
  startedAt: new Date('2026-08-15T03:12:04.000Z'),
  completedAt: new Date('2026-08-15T03:44:04.000Z'),
  durationSeconds: 1920,
  distanceMeters: 0,
  paceSecondsPerMeter: null,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      name: 'Mugi',
    },
  ],
}

function createFinishWalkApp(
  finishWalk: FinishWalk,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerFinishWalkRoute(routeApp, finishWalk)
  })
}

const authorizedHeaders = {
  Authorization: 'Bearer access',
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Idempotency-Key': idempotencyKey,
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

async function assertInvalidInput(response: Response, calls: unknown[]) {
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 400)
  assert.equal(body.code, 'INVALID_INPUT')
  assert.equal(body.message, '入力内容を確認してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
}

test('POST /v1/walks/:walkId/finish returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createFinishWalkApp(async () => {
    calls.push('finish')
    return { ok: true, walk }
  }, async () => {
    throw new Error('should not verify')
  }).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({}),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(body.code, 'UNAUTHENTICATED')
  assert.equal(body.message, 'Authentication is required.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/walks/:walkId/finish returns 200 completed walk', async () => {
  const calls: Array<{
    cognitoSubject: string
    walkId: string
    idempotencyKey: string
  }> = []
  const response = await createFinishWalkApp(async (input) => {
    calls.push(input)
    return { ok: true, walk }
  }).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  })
  const body = await response.json() as {
    requestId: string
    walkId: string
    state: string
    startedAt: string
    completedAt: string
    durationSeconds: number
    distanceMeters: number
    paceSecondsPerMeter: number | null
  }
  assert.equal(response.status, 200)
  assert.ok(body.requestId)
  assert.equal(body.walkId, walk.walkId)
  assert.equal(body.state, 'completed')
  assert.equal(body.startedAt, '2026-08-15T03:12:04.000Z')
  assert.equal(body.completedAt, '2026-08-15T03:44:04.000Z')
  assert.equal(body.durationSeconds, 1920)
  assert.equal(body.distanceMeters, 0)
  assert.equal(body.paceSecondsPerMeter, null)
  assert.deepEqual(calls, [{
    cognitoSubject: 'sub-1',
    walkId,
    idempotencyKey,
  }])
})

test('POST /v1/walks/:walkId/finish returns 200 with the same walk for the same Idempotency-Key', async () => {
  const app = createFinishWalkApp(async () => ({ ok: true, walk }))
  const request = {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  }
  const first = await app.request(`/v1/walks/${walkId}/finish`, request)
  const second = await app.request(`/v1/walks/${walkId}/finish`, request)
  const firstBody = await first.json() as { walkId: string; state: string }
  const secondBody = await second.json() as { walkId: string; state: string }
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(firstBody.walkId, walk.walkId)
  assert.equal(firstBody.state, 'completed')
  assert.equal(secondBody.walkId, firstBody.walkId)
  assert.equal(secondBody.state, 'completed')
})

test('POST /v1/walks/:walkId/finish returns 400 for unexpected body fields', async () => {
  const calls: string[] = []
  const response = await createFinishWalkApp(async () => {
    calls.push('finish')
    return { ok: true, walk }
  }).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ extra: true }),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks/:walkId/finish returns 400 when Idempotency-Key is missing', async () => {
  const calls: string[] = []
  const response = await createFinishWalkApp(async () => {
    calls.push('finish')
    return { ok: true, walk }
  }).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer access',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({}),
  })
  await assertInvalidInput(response, calls)
})

test('POST /v1/walks/:walkId/finish returns 404 NOT_FOUND when the walk is missing', async () => {
  const response = await createFinishWalkApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('POST /v1/walks/:walkId/finish returns 404 NOT_FOUND for another owner walk', async () => {
  const response = await createFinishWalkApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('POST /v1/walks/:walkId/finish returns 404 NOT_FOUND for a non-UUID walkId', async () => {
  const calls: string[] = []
  const response = await createFinishWalkApp(async () => {
    calls.push('finish')
    throw new Error('finishWalk should not run for a non-UUID walkId')
  }).request('/v1/walks/not-a-uuid/finish', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(body.code, 'NOT_FOUND')
  assert.equal(body.message, 'The requested resource was not found.')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST /v1/walks/:walkId/finish returns 409 WALK_NOT_RECORDING when the walk is not recording', async () => {
  const response = await createFinishWalkApp(async () => ({
    ok: false,
    error: 'walk_not_recording',
  })).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(body.code, 'WALK_NOT_RECORDING')
  assert.equal(body.message, 'この散歩は終了できません。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('POST /v1/walks/:walkId/finish returns 409 IDEMPOTENCY_CONFLICT when the same key has a different body', async () => {
  const response = await createFinishWalkApp(async () => ({
    ok: false,
    error: 'idempotency_conflict',
  })).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({}),
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(body.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(body.message, '同じ要求を完了できません。最初からやり直してください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, false)
})

test('POST /v1/walks/:walkId/finish returns 503 SERVICE_UNAVAILABLE when confirmation times out', async () => {
  const response = await createFinishWalkApp(async () => ({
    ok: false,
    error: 'service_unavailable',
  })).request(`/v1/walks/${walkId}/finish`, {
    method: 'POST',
    headers: authorizedHeaders,
    body: '{}',
  })
  const body = await response.json() as ErrorBody
  assert.equal(response.status, 503)
  assert.equal(body.code, 'SERVICE_UNAVAILABLE')
  assert.equal(body.message, '終了処理を完了できませんでした。もう一度お試しください。')
  assert.ok(body.requestId)
  assert.equal(body.retryable, true)
})
