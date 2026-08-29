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

test('TrackPoint response schema accepts API values and rejects invalid identifiers and precision', () => {
  assert.equal(trackPointResponseSchema.safeParse(trackPointResponse).success, true)
  assert.equal(
    trackPointResponseSchema.safeParse({ ...trackPointResponse, trackPointId: 'point-1' }).success,
    false,
  )
  assert.equal(
    trackPointResponseSchema.safeParse({ ...trackPointResponse, longitude: 139.7612345 }).success,
    false,
  )
})

test('toLocalTrackPoint rounds GPS coordinates to API precision', () => {
  const point = toLocalTrackPoint({
    walkId: trackPointResponse.walkId,
    recordedAt: trackPointResponse.recordedAt,
    latitude: 35.6812347,
    longitude: 139.7612347,
  })

  assert.equal(point.latitude, 35.681235)
  assert.equal(point.longitude, 139.761235)
})

test('postTrackPoint rejects a malformed successful response', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test'
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ...trackPointResponse,
        trackPointId: 'point-1',
      }),
      { status: 201 },
    )

  try {
    await assert.rejects(postTrackPoint('access-token', trackPointResponse))
  } finally {
    globalThis.fetch = originalFetch
    if (originalBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl
    }
  }
})
