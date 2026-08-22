import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseTrackPointMessage,
  toTrackPointMessage,
} from '../../../src/modules/walks/track-point-message.js'

const trackPoint = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt: new Date('2026-08-17T03:12:14.000Z'),
  latitude: 35.681236,
  longitude: 139.767125,
}

const message = JSON.stringify({
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
  recordedAt: '2026-08-17T03:12:14.000Z',
  latitude: 35.681236,
  longitude: 139.767125,
})

test('toTrackPointMessage serializes recordedAt as ISO UTC', () => {
  assert.equal(toTrackPointMessage(trackPoint), message)
})

test('parseTrackPointMessage returns the TrackPoint', () => {
  assert.deepEqual(parseTrackPointMessage(message), trackPoint)
})

test('parseTrackPointMessage throws when the body is not a TrackPoint', () => {
  assert.throws(
    () => parseTrackPointMessage(JSON.stringify({ walkId: trackPoint.walkId })),
    { message: 'invalid track point message' },
  )
})
