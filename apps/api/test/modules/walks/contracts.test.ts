import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acceptTrackPointRequestSchema,
  trackPointResponseSchema,
} from '../../../src/modules/walks/contracts.js'
import { toTrackPointResponse } from '../../../src/modules/walks/walk-response.js'

const recordedAt = new Date('2026-08-17T03:12:14.000Z')
const trackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}

test('acceptTrackPointRequestSchema accepts recordedAt and coordinates', () => {
  assert.deepEqual(
    acceptTrackPointRequestSchema.parse({
      recordedAt: '2026-08-17T03:12:14.000Z',
      latitude: 35.681236,
      longitude: 139.767125,
    }),
    {
      recordedAt: '2026-08-17T03:12:14.000Z',
      latitude: 35.681236,
      longitude: 139.767125,
    },
  )
})

test('acceptTrackPointRequestSchema rejects latitude 91', () => {
  assert.equal(
    acceptTrackPointRequestSchema.safeParse({
      recordedAt: '2026-08-17T03:12:14.000Z',
      latitude: 91,
      longitude: 139.767125,
    }).success,
    false,
  )
})

test('toTrackPointResponse serializes recordedAt as ISO UTC', () => {
  assert.deepEqual(
    toTrackPointResponse('req-1', trackPoint),
    {
      requestId: 'req-1',
      trackPointId: trackPoint.trackPointId,
      walkId: trackPoint.walkId,
      recordedAt: '2026-08-17T03:12:14.000Z',
      latitude: 35.681236,
      longitude: 139.767125,
    },
  )
})

test('trackPointResponseSchema accepts the mapped TrackPoint body', () => {
  const body = toTrackPointResponse('req-1', trackPoint)
  assert.deepEqual(trackPointResponseSchema.parse(body), body)
})
