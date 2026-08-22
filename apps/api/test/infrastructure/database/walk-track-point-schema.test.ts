import assert from 'node:assert/strict'
import test from 'node:test'
import {
  latitudeSchema,
  longitudeSchema,
  walkTrackPoints,
  type NewWalkTrackPoint,
  type WalkTrackPoint,
} from '../../../src/infrastructure/database/schema/walk-track-point.js'

test('walk_track_points stores latitude and longitude as numeric with scale', () => {
  assert.equal(walkTrackPoints.latitude.getSQLType(), 'numeric(8, 6)')
  assert.equal(walkTrackPoints.longitude.getSQLType(), 'numeric(9, 6)')
})

test('latitude matches numeric(8, 6)', () => {
  assert.equal(latitudeSchema.safeParse(35.681236).success, true)
  assert.equal(latitudeSchema.safeParse(99.999999).success, true)
  assert.equal(latitudeSchema.safeParse(100).success, false)
  assert.equal(latitudeSchema.safeParse(35.6812361).success, false)
})

test('longitude matches numeric(9, 6)', () => {
  assert.equal(longitudeSchema.safeParse(139.767125).success, true)
  assert.equal(longitudeSchema.safeParse(999.999999).success, true)
  assert.equal(longitudeSchema.safeParse(1000).success, false)
  assert.equal(longitudeSchema.safeParse(139.7671251).success, false)
})

test('walk_track_points select and insert models include the coordinate columns', () => {
  const insert: NewWalkTrackPoint = {
    walkId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80',
    recordedAt: new Date('2026-08-17T03:12:14.000Z'),
    latitude: 35.681236,
    longitude: 139.767125,
  }
  const row: WalkTrackPoint = {
    trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
    createdAt: new Date('2026-08-17T03:12:14.000Z'),
    ...insert,
  }
  assert.equal(row.latitude, insert.latitude)
  assert.equal(row.longitude, insert.longitude)
})
