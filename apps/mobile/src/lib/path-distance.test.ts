import assert from 'node:assert/strict'
import test from 'node:test'
import { pathDistanceMeters, paceSecondsPerMeter } from './path-distance.ts'

test('pathDistanceMeters returns 0 for fewer than 2 points', () => {
  assert.equal(pathDistanceMeters([]), 0)
  assert.equal(pathDistanceMeters([{ latitude: 35, longitude: 139 }]), 0)
})

test('pathDistanceMeters sums haversine segments as integer meters', () => {
  const meters = pathDistanceMeters([
    { latitude: 35.0, longitude: 139.0 },
    { latitude: 35.001, longitude: 139.0 },
  ])
  assert.equal(meters, 111)
})

test('paceSecondsPerMeter is null when distance is 0', () => {
  assert.equal(paceSecondsPerMeter(100, 0), null)
})

test('paceSecondsPerMeter divides duration by distance', () => {
  assert.equal(paceSecondsPerMeter(1920, 2100), 1920 / 2100)
})
