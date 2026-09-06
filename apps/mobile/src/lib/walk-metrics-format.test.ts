import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDistanceMeters, formatPacePerKm } from './walk-metrics-format.ts'

test('formatDistanceMeters uses meters below 1000', () => {
  assert.deepEqual(formatDistanceMeters(0), { value: '0', unit: 'm' })
  assert.deepEqual(formatDistanceMeters(500), { value: '500', unit: 'm' })
  assert.deepEqual(formatDistanceMeters(999), { value: '999', unit: 'm' })
})

test('formatDistanceMeters uses km at 1000 and above', () => {
  assert.deepEqual(formatDistanceMeters(1000), { value: '1.00', unit: 'km' })
  assert.deepEqual(formatDistanceMeters(1340), { value: '1.34', unit: 'km' })
})

test('formatPacePerKm is em dash when pace is null', () => {
  assert.equal(formatPacePerKm(null), '—')
})

test('formatPacePerKm formats seconds-per-meter as mm:ss per km', () => {
  assert.equal(formatPacePerKm(1122 / 1340), '13:57')
  assert.equal(formatPacePerKm(1920 / 2100), '15:14')
})
