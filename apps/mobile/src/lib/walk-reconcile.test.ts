import assert from 'node:assert/strict'
import test from 'node:test'
import { decideRecordingVerify, decideWalkLoad } from './walk-reconcile.ts'

test('keep recording when location is granted and active walk exists', () => {
  assert.deepEqual(
    decideRecordingVerify({
      locationGranted: true,
      activeWalk: { walkId: 'w1' },
    }),
    { action: 'keep' },
  )
})

test('fail walk when location is not granted during recording verify', () => {
  assert.deepEqual(
    decideRecordingVerify({
      locationGranted: false,
      activeWalk: { walkId: 'w1' },
    }),
    { action: 'fail_walk' },
  )
})

test('mark failed when active walk is missing', () => {
  assert.deepEqual(
    decideRecordingVerify({
      locationGranted: true,
      activeWalk: null,
    }),
    { action: 'mark_failed' },
  )
})

test('load decides recording when active walk exists', () => {
  const walk = { walkId: 'w1' }
  assert.deepEqual(decideWalkLoad(walk), { kind: 'recording', walk })
})

test('load decides ready when active walk is absent', () => {
  assert.deepEqual(decideWalkLoad(null), { kind: 'ready' })
})
