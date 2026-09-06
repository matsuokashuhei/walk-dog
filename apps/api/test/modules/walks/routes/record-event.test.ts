import assert from 'node:assert/strict'
import test from 'node:test'
import {
  recordEventRoute,
  registerRecordEventRoute,
} from '../../../../src/modules/walks/routes/record-event.js'
import type { RecordEvent, WalkEvent } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(recordEventRoute.method, 'post')
assert.equal(recordEventRoute.path, '/{walkId}/events')
assert.deepEqual(recordEventRoute.security, [{ BearerAuth: [] }])

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const path = `/v1/walks/${walkId}/events`
const body = {
  eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  participantDogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  type: 'pee',
  occurredAt: '2026-09-06T03:20:11.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
}

const expectedEvent: WalkEvent = {
  eventId: body.eventId,
  walkId,
  participantDogId: body.participantDogId,
  type: 'pee',
  occurredAt: new Date(body.occurredAt),
  latitude: 35.681236,
  longitude: 139.767125,
}

function createRecordApp(
  recordEvent: RecordEvent,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerRecordEventRoute(routeApp, recordEvent)
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

type EventBody = {
  requestId: string
  eventId: string
  walkId: string
  participantDogId: string
  type: string
  occurredAt: string
  latitude: number
  longitude: number
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

async function assertEventBody(response: Response, status: 200 | 201) {
  const json = await response.json() as EventBody
  assert.equal(response.status, status)
  assert.ok(json.requestId)
  assert.equal(json.eventId, expectedEvent.eventId)
  assert.equal(json.walkId, walkId)
  assert.equal(json.participantDogId, expectedEvent.participantDogId)
  assert.equal(json.type, 'pee')
  assert.equal(json.occurredAt, '2026-09-06T03:20:11.000Z')
  assert.equal(json.latitude, 35.681236)
  assert.equal(json.longitude, 139.767125)
  return json
}

test('POST events returns 201 Event when created', async () => {
  const calls: Array<{
    cognitoSubject: string
    walkId: string
    eventId: string
    participantDogId: string
    type: string
    occurredAt: Date
    latitude: number
    longitude: number
  }> = []
  const response = await createRecordApp(async (input) => {
    calls.push(input)
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  await assertEventBody(response, 201)
  assert.deepEqual(calls, [{
    cognitoSubject: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
    walkId,
    eventId: body.eventId,
    participantDogId: body.participantDogId,
    type: 'pee',
    occurredAt: new Date('2026-09-06T03:20:11.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  }])
})

test('POST events returns 200 Event on idempotent replay', async () => {
  const response = await createRecordApp(async () => ({
    ok: true,
    event: expectedEvent,
    created: false,
  })).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  await assertEventBody(response, 200)
})

test('POST events returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
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

test('POST events returns 400 INVALID_INPUT for missing eventId', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({
      participantDogId: body.participantDogId,
      type: body.type,
      occurredAt: body.occurredAt,
      latitude: body.latitude,
      longitude: body.longitude,
    }),
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 400 for invalid type', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, type: 'bark' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 400 for latitude 91', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, latitude: 91 }),
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 400 for longitude 181', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, longitude: 181 }),
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 400 for unexpected body fields', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, extra: true }),
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 400 for a malformed JSON body', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: '{',
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 400 for an empty occurredAt', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    return { ok: true, event: expectedEvent, created: true }
  }).request(path, {
    method: 'POST',
    headers: authorizedHeaders,
    body: JSON.stringify({ ...body, occurredAt: '' }),
  })
  await assertInvalidInput(response, calls)
})

test('POST events returns 404 Walk が見つかりません。', async () => {
  const response = await createRecordApp(async () => ({
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

test('POST events returns 404 Walk が見つかりません。 for a non-UUID walkId', async () => {
  const calls: string[] = []
  const response = await createRecordApp(async () => {
    calls.push('record')
    throw new Error('recordEvent should not run for a non-UUID walkId')
  }).request('/v1/walks/not-a-uuid/events', {
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

test('POST events returns 409 WALK_NOT_RECORDING この散歩には記録できません。', async () => {
  const response = await createRecordApp(async () => ({
    ok: false,
    error: 'walk_not_recording',
  })).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(json.code, 'WALK_NOT_RECORDING')
  assert.equal(json.message, 'この散歩には記録できません。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
})

test('POST events returns 409 IDEMPOTENCY_CONFLICT 同じ要求を完了できません。最初からやり直してください。', async () => {
  const response = await createRecordApp(async () => ({
    ok: false,
    error: 'idempotency_conflict',
  })).request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 409)
  assert.equal(json.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(json.message, '同じ要求を完了できません。最初からやり直してください。')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
})

test('POST events returns 500 INTERNAL_ERROR retryable true when record throws', async () => {
  const response = await createRecordApp(async () => { throw new Error('db') })
    .request(path, { method: 'POST', headers: authorizedHeaders, body: JSON.stringify(body) })
  const json = await response.json() as { code: string; message: string; retryable: boolean }
  assert.equal(response.status, 500)
  assert.equal(json.code, 'INTERNAL_ERROR')
  assert.equal(json.message, '記録に失敗しました。')
  assert.equal(json.retryable, true)
})
