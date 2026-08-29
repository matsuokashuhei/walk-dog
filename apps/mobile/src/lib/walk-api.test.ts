import assert from 'node:assert/strict'
import test from 'node:test'
import { postTrackPoint, toLocalTrackPoint } from './walk-api.ts'
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
    globalThis.fetch = originalFetch
    if (originalBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl
    }
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
    globalThis.fetch = originalFetch
    if (originalBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl
    }
  }
})
