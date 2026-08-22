import assert from 'node:assert/strict'
import test from 'node:test'
import { walkTrackPoints } from '../../../src/infrastructure/database/schema/walk-track-point.js'

test('walk_track_points stores latitude and longitude as numeric with scale', () => {
  assert.equal(walkTrackPoints.latitude.getSQLType(), 'numeric(8, 6)')
  assert.equal(walkTrackPoints.longitude.getSQLType(), 'numeric(9, 6)')
})
