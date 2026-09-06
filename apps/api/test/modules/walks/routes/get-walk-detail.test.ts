import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getWalkDetailRoute,
  registerGetWalkDetailRoute,
} from '../../../../src/modules/walks/routes/get-walk-detail.js'
import type { GetWalkDetail, WalkDetail } from '../../../../src/modules/walks/types.js'
import { createAuthenticationMiddleware } from '../../../../src/shared/http/authentication-middleware.js'
import { createWalkApp } from '../fixtures.js'

assert.equal(getWalkDetailRoute.method, 'get')
assert.equal(getWalkDetailRoute.path, '/{walkId}')
assert.deepEqual(getWalkDetailRoute.security, [{ BearerAuth: [] }])

const walkId = '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80'
const path = `/v1/walks/${walkId}`

const detail: WalkDetail = {
  walkId,
  ownerId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e6f',
  state: 'completed',
  startedAt: new Date('2026-09-06T03:12:04.000Z'),
  completedAt: new Date('2026-09-06T03:44:04.000Z'),
  durationSeconds: 1920,
  distanceMeters: 2100,
  paceSecondsPerMeter: 1920 / 2100,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      name: 'Mugi',
    },
  ],
  trackPoints: [
    {
      recordedAt: new Date('2026-09-06T03:12:14.000Z'),
      latitude: 35.6812,
      longitude: 139.7671,
    },
  ],
  events: [
    {
      eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
      walkId,
      participantDogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      type: 'pee',
      occurredAt: new Date('2026-09-06T03:20:11.000Z'),
      latitude: 35.681236,
      longitude: 139.767125,
    },
  ],
}

function createDetailApp(
  getWalkDetail: GetWalkDetail,
  verify: (accessToken: string) => Promise<{ cognitoSubject: string }> = async () => ({
    cognitoSubject: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  }),
) {
  return createWalkApp((routeApp) => {
    routeApp.use('*', createAuthenticationMiddleware({ verify }))
    registerGetWalkDetailRoute(routeApp, getWalkDetail)
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

type DetailBody = {
  requestId: string
  walkId: string
  ownerId: string
  state: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  distanceMeters: number
  paceSecondsPerMeter: number | null
  participants: Array<{ walkParticipantId: string; dogId: string; name: string }>
  trackPoints: Array<{ recordedAt: string; latitude: number; longitude: number }>
  events: Array<{
    eventId: string
    participantDogId: string
    type: string
    occurredAt: string
    latitude: number
    longitude: number
  }>
}

test('GET /v1/walks/:walkId returns 401 without Authorization', async () => {
  const calls: string[] = []
  const response = await createDetailApp(async () => {
    calls.push('detail')
    return { ok: true, detail }
  }, async () => {
    throw new Error('should not verify')
  }).request(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 401)
  assert.equal(json.code, 'UNAUTHENTICATED')
  assert.equal(json.message, 'Authentication is required.')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
  assert.deepEqual(calls, [])
})

test('GET /v1/walks/:walkId returns 200 WalkDetail', async () => {
  const calls: Array<{ cognitoSubject: string; walkId: string }> = []
  const response = await createDetailApp(async (input) => {
    calls.push(input)
    return { ok: true, detail }
  }).request(path, { method: 'GET', headers: authorizedHeaders })
  const json = await response.json() as DetailBody
  assert.equal(response.status, 200)
  assert.ok(json.requestId)
  assert.equal(json.walkId, walkId)
  assert.equal(json.ownerId, detail.ownerId)
  assert.equal(json.state, 'completed')
  assert.equal(json.startedAt, '2026-09-06T03:12:04.000Z')
  assert.equal(json.completedAt, '2026-09-06T03:44:04.000Z')
  assert.equal(json.durationSeconds, 1920)
  assert.equal(json.distanceMeters, 2100)
  assert.equal(json.paceSecondsPerMeter, 1920 / 2100)
  assert.deepEqual(json.participants, detail.participants)
  assert.deepEqual(json.trackPoints, [
    {
      recordedAt: '2026-09-06T03:12:14.000Z',
      latitude: 35.6812,
      longitude: 139.7671,
    },
  ])
  assert.deepEqual(json.events, [
    {
      eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
      participantDogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
      type: 'pee',
      occurredAt: '2026-09-06T03:20:11.000Z',
      latitude: 35.681236,
      longitude: 139.767125,
    },
  ])
  assert.deepEqual(calls, [{
    cognitoSubject: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
    walkId,
  }])
})

test('GET /v1/walks/:walkId returns empty trackPoints and events arrays', async () => {
  const emptyDetail: WalkDetail = {
    ...detail,
    distanceMeters: 0,
    paceSecondsPerMeter: null,
    trackPoints: [],
    events: [],
  }
  const response = await createDetailApp(async () => ({
    ok: true,
    detail: emptyDetail,
  })).request(path, { method: 'GET', headers: authorizedHeaders })
  const json = await response.json() as DetailBody
  assert.equal(response.status, 200)
  assert.equal(json.distanceMeters, 0)
  assert.equal(json.paceSecondsPerMeter, null)
  assert.deepEqual(json.trackPoints, [])
  assert.deepEqual(json.events, [])
})

test('GET /v1/walks/:walkId returns 404 NOT_FOUND when the walk is missing', async () => {
  const response = await createDetailApp(async () => ({
    ok: false,
    error: 'not_found',
  })).request(path, { method: 'GET', headers: authorizedHeaders })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(json.code, 'NOT_FOUND')
  assert.equal(json.message, 'The requested resource was not found.')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
})

test('GET /v1/walks/:walkId returns 404 for a non-UUID walkId', async () => {
  const calls: string[] = []
  const response = await createDetailApp(async () => {
    calls.push('detail')
    return { ok: true, detail }
  }).request('/v1/walks/not-a-uuid', { method: 'GET', headers: authorizedHeaders })
  const json = await response.json() as ErrorBody
  assert.equal(response.status, 404)
  assert.equal(json.code, 'NOT_FOUND')
  assert.equal(json.message, 'The requested resource was not found.')
  assert.ok(json.requestId)
  assert.equal(json.retryable, false)
  assert.deepEqual(calls, [])
})
