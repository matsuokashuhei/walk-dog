import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getLocationPermissionAction,
  handleWalkAppStateChange,
} from './location-permission.ts'

test('allows walking when foreground and background permissions are granted', () => {
  assert.equal(getLocationPermissionAction('granted', 'granted'), 'granted')
})

test('requests location permission while neither permission is denied', () => {
  assert.equal(getLocationPermissionAction('undetermined', 'undetermined'), 'request')
  assert.equal(getLocationPermissionAction('granted', 'undetermined'), 'request')
})

test('opens app settings when either location permission is denied', () => {
  assert.equal(getLocationPermissionAction('denied', 'undetermined'), 'settings')
  assert.equal(getLocationPermissionAction('granted', 'denied'), 'settings')
})

test('reloads a ready walk when the app becomes active', () => {
  let readyLoads = 0
  let recordingChecks = 0

  handleWalkAppStateChange('active', 'ready', {
    loadReady: () => {
      readyLoads += 1
    },
    verifyRecording: () => {
      recordingChecks += 1
    },
  })

  assert.equal(readyLoads, 1)
  assert.equal(recordingChecks, 0)
})

test('checks a recording walk when the app becomes active', () => {
  let recordingChecks = 0

  handleWalkAppStateChange('active', 'recording', {
    loadReady: () => {},
    verifyRecording: () => {
      recordingChecks += 1
    },
  })

  assert.equal(recordingChecks, 1)
})
