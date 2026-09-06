import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getWalkDetail,
  postEvent,
  postTrackPoint,
  toLocalTrackPoint,
  toLocalWalkEvent,
} from './walk-api.ts'
import { walkEventResponseSchema } from './walk-event-schema.ts'
import { trackPointResponseSchema } from './walk-track-point-schema.ts'

const originalFetch = globalThis.fetch
const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL

const trackPointResponse = {
  requestId: 'req-1',
  trackPointId: 'f4b1b8c4-0e46-4a0d-a32f-8c9e23d4e91c',
  walkId: 'bf9d126a-df35-4f08-861b-786947be62dc',
  recordedAt: '2026-08-17T03:12:14.000Z',
  latitude: 35.681234,
  longitude: 139.761234,
}

const eventResponse = {
  requestId: 'req-event-1',
  eventId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  participantDogId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70',
  type: 'pee' as const,
  occurredAt: '2026-09-06T03:20:11.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
}

const walkDetailResponse = {
  requestId: 'req-detail-1',
  walkId: eventResponse.walkId,
  ownerId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e6f',
  state: 'completed' as const,
  startedAt: '2026-09-06T03:12:04.000Z',
  completedAt: '2026-09-06T03:44:04.000Z',
  durationSeconds: 1920,
  distanceMeters: 2100,
  paceSecondsPerMeter: 1920 / 2100,
  participants: [
    {
      walkParticipantId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81',
      dogId: eventResponse.participantDogId,
      name: 'Mugi',
    },
  ],
  trackPoints: [
    {
      recordedAt: '2026-09-06T03:12:14.000Z',
      latitude: 35.6812,
      longitude: 139.7671,
    },
  ],
  events: [
    {
      eventId: eventResponse.eventId,
      participantDogId: eventResponse.participantDogId,
      type: eventResponse.type,
      occurredAt: eventResponse.occurredAt,
      latitude: eventResponse.latitude,
      longitude: eventResponse.longitude,
    },
  ],
}

function restoreFetchEnv(): void {
  globalThis.fetch = originalFetch
  if (originalBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl
  }
}

test('TrackPoint response schema accepts API values and rejects an invalid identifier', () => {
  assert.equal(trackPointResponseSchema.safeParse(trackPointResponse).success, true)
  assert.equal(
    trackPointResponseSchema.safeParse({ ...trackPointResponse, trackPointId: 'point-1' }).success,
    false,
  )
})

test('toLocalTrackPoint rounds GPS coordinates without throwing on leftover float error', () => {
  const point = toLocalTrackPoint({
    walkId: trackPointResponse.walkId,
    recordedAt: trackPointResponse.recordedAt,
    latitude: 35.681234123456,
    longitude: 139.761234123456,
  })

  assert.equal(point.latitude, 35.681234)
  assert.equal(point.longitude, 139.761234)
})

test('postTrackPoint sends recordedAt latitude longitude and accepts extra response fields', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test'
  let request: { url: string; method: string | undefined; body: string | undefined } | undefined
  globalThis.fetch = async (input, init) => {
    request = {
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
    }
    return new Response(
      JSON.stringify({
        ...trackPointResponse,
        extra: 'ignored',
        longitude: 139.7612345,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    await postTrackPoint('access-token', trackPointResponse)
    assert.equal(request?.method, 'POST')
    assert.equal(
      request?.url,
      `https://api.example.test/v1/walks/${trackPointResponse.walkId}/track-points`,
    )
    assert.equal(
      request?.body,
      JSON.stringify({
        recordedAt: trackPointResponse.recordedAt,
        latitude: trackPointResponse.latitude,
        longitude: trackPointResponse.longitude,
      }),
    )
  } finally {
    restoreFetchEnv()
  }
})

test('postTrackPoint treats HTTP 201 as accepted when the body is malformed', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test'
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ...trackPointResponse,
        trackPointId: 'point-1',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )

  try {
    await postTrackPoint('access-token', trackPointResponse)
  } finally {
    restoreFetchEnv()
  }
})

test('WalkEvent response schema accepts API values and rejects an invalid type', () => {
  assert.equal(walkEventResponseSchema.safeParse(eventResponse).success, true)
  assert.equal(
    walkEventResponseSchema.safeParse({ ...eventResponse, type: 'bark' }).success,
    false,
  )
})

test('toLocalWalkEvent rounds GPS coordinates without throwing on leftover float error', () => {
  const local = toLocalWalkEvent({
    eventId: eventResponse.eventId,
    walkId: eventResponse.walkId,
    participantDogId: eventResponse.participantDogId,
    type: eventResponse.type,
    occurredAt: eventResponse.occurredAt,
    latitude: 35.681236123456,
    longitude: 139.767125123456,
  })

  assert.equal(local.latitude, 35.681236)
  assert.equal(local.longitude, 139.767125)
})

test('postEvent sends eventId participantDogId type occurredAt lat lng', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test'
  let request: { url: string; method: string | undefined; body: string | undefined } | undefined
  globalThis.fetch = async (input, init) => {
    request = {
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
    }
    return new Response(JSON.stringify(eventResponse), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await postEvent('access-token', eventResponse.walkId, {
      eventId: eventResponse.eventId,
      participantDogId: eventResponse.participantDogId,
      type: eventResponse.type,
      occurredAt: eventResponse.occurredAt,
      latitude: eventResponse.latitude,
      longitude: eventResponse.longitude,
    })
    assert.equal(request?.method, 'POST')
    assert.equal(
      request?.url,
      `https://api.example.test/v1/walks/${eventResponse.walkId}/events`,
    )
    assert.equal(
      request?.body,
      JSON.stringify({
        eventId: eventResponse.eventId,
        participantDogId: eventResponse.participantDogId,
        type: eventResponse.type,
        occurredAt: eventResponse.occurredAt,
        latitude: eventResponse.latitude,
        longitude: eventResponse.longitude,
      }),
    )
    assert.deepEqual(result, eventResponse)
  } finally {
    restoreFetchEnv()
  }
})

test('postEvent treats HTTP 200 replay as success', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test'
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ...eventResponse, requestId: 'req-replay' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    const result = await postEvent('access-token', eventResponse.walkId, {
      eventId: eventResponse.eventId,
      participantDogId: eventResponse.participantDogId,
      type: eventResponse.type,
      occurredAt: eventResponse.occurredAt,
      latitude: eventResponse.latitude,
      longitude: eventResponse.longitude,
    })
    assert.equal(result.requestId, 'req-replay')
    assert.equal(result.eventId, eventResponse.eventId)
  } finally {
    restoreFetchEnv()
  }
})

test('getWalkDetail fetches completed walk path and events', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test'
  let request: { url: string; method: string | undefined } | undefined
  globalThis.fetch = async (input, init) => {
    request = {
      url: String(input),
      method: init?.method,
    }
    return new Response(JSON.stringify(walkDetailResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await getWalkDetail('access-token', eventResponse.walkId)
    assert.equal(request?.method, 'GET')
    assert.equal(
      request?.url,
      `https://api.example.test/v1/walks/${eventResponse.walkId}`,
    )
    assert.equal(result.distanceMeters, 2100)
    assert.equal(result.paceSecondsPerMeter, 1920 / 2100)
    assert.deepEqual(result.events, walkDetailResponse.events)
    assert.deepEqual(result.trackPoints, walkDetailResponse.trackPoints)
  } finally {
    restoreFetchEnv()
  }
})
