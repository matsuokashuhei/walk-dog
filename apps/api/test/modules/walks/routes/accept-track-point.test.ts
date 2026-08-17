import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acceptTrackPointRoute,
  registerAcceptTrackPointRoute,
} from '../../../../src/modules/walks/routes/accept-track-point.js'
import type { AcceptTrackPoint, TrackPoint } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(acceptTrackPointRoute.method, 'post')
assert.equal(acceptTrackPointRoute.path, '/{walkId}/track-points')
assert.deepEqual(acceptTrackPointRoute.security, [{ BearerAuth: [] }])

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const path = `/v1/walks/${walkId}/track-points`
const body = {
  recordedAt: '2026-08-17T03:12:14.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
}

const expectedTrackPoint: TrackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId,
  recordedAt: new Date('2026-08-17T03:12:14.000Z'),
  latitude: 35.681236,
  longitude: 139.767125,
}

function createAcceptApp(
  acceptTrackPoint: AcceptTrackPoint,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: 'sub-1',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerAcceptTrackPointRoute(routeApp, acceptTrackPoint)
  })
}

const authorizedHeaders = {
  Authorization: 'Bearer access',
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

type ErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

async function assertInvalidInput(response: Response, calls: unknown[]) {
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 400)
  assert.equal(json.code, 'INVALID_INPUT')
  assert.equal(json.message, '入力内容を確認してください。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
  assert.deepEqual(calls, [])
}

test('POST track-points returns 201 TrackPoint', async () => {
  const calls: Array<{
    cognitoSubject: string
    walkId: string
    recordedAt: Date
    latitude: number
    longitude: number
  }> = []
  const response = await createAcceptApp(async (input) => {
    calls.push(input)
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as {
    requestId: string
    trackPointId: string
    walkId: string
    recordedAt: string
    latitude: number
    longitude: number
  }
  assert.equal(response.status, 201)
  assert.ok(json.requestId)
  assert.equal(json.trackPointId, expectedTrackPoint.trackPointId)
  assert.equal(json.walkId, walkId)
  assert.equal(json.recordedAt, '2026-08-17T03:12:14.000Z')
  assert.equal(json.latitude, 35.681236)
  assert.equal(json.longitude, 139.767125)
  assert.deepEqual(calls, [{
    cognitoSubject: 'sub-1',
    walkId,
    recordedAt: new Date('2026-08-17T03:12:14.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  }])
})

test('POST track-points returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }, async () => {
    throw new Error('should not verify')
  }).request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(json.code, 'UNAUTHENTICATED')
  assert.equal(json.message, 'Authentication is required.')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST track-points returns 400 INVALID_INPUT for missing recordedAt', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ latitude: 35.681236, longitude: 139.767125 }),
  })
  await assertInvalidInput(response, calls)
})

test('POST track-points returns 400 for latitude 91', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, latitude: 91 }),
  })
  await assertInvalidInput(response, calls)
})

test('POST track-points returns 400 for longitude 181', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, longitude: 181 }),
  })
  await assertInvalidInput(response, calls)
})

test('POST track-points returns 400 for unexpected body fields', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, extra: true }),
  })
  await assertInvalidInput(response, calls)
})

test('POST track-points returns 400 for a malformed JSON body', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: '{',
  })
  await assertInvalidInput(response, calls)
})

test('POST track-points returns 400 for an empty recordedAt', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    return { ok: true, trackPoint: expectedTrackPoint }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, recordedAt: '' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST track-points returns 404 Walk が見つかりません。', async () => {
  const response = await createAcceptApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(json.code, 'NOT_FOUND')
  assert.equal(json.message, 'Walk が見つかりません。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
})

test('POST track-points returns 404 Walk が見つかりません。 for a non-UUID walkId', async () => {
  const calls: string[] = []
  const response = await createAcceptApp(async () => {
    calls.push('accept')
    throw new Error('acceptTrackPoint should not run for a non-UUID walkId')
  }).request('/v1/walks/not-a-uuid/track-points', {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify(body),
  })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(json.code, 'NOT_FOUND')
  assert.equal(json.message, 'Walk が見つかりません。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
  assert.deepEqual(calls, [])
})

test('POST track-points returns 409 WALK_NOT_RECORDING この Walk は記録中ではありません。', async () => {
  const response = await createAcceptApp(async () => ({
    ok: false,
    error: 'walk_not_recording',
  })).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(json.code, 'WALK_NOT_RECORDING')
  assert.equal(json.message, 'この Walk は記録中ではありません。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
})

test('POST track-points returns 409 IDEMPOTENCY_CONFLICT 同じ取得時刻の TrackPoint が別の内容で送られています。', async () => {
  const response = await createAcceptApp(async () => ({
    ok: false,
    error: 'idempotency_conflict',
  })).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(json.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(json.message, '同じ取得時刻の TrackPoint が別の内容で送られています。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
})

test('POST track-points returns 500 INTERNAL_ERROR retryable true when accept throws', async () => {
  const response = await createAcceptApp(async () => { throw new Error('sqs') })
    .request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as { code: string; message: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(json.code, 'INTERNAL_ERROR')
  assert.equal(json.message, '一時的に送信できません。')
  assert.equal(json.retryable, true)
})
