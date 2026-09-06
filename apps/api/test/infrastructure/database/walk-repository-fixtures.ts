import { uniqueViolation } from './walk-repository-fake.js'

export const startedAt = new Date('2026-08-15T12:00:00.000Z')
export const completedAt = new Date('2026-08-15T12:10:30.500Z')
export const ownerId = '019fc312-f7eb-73c4-9351-2a6ea25e4fcb'
export const otherOwnerId = '019fc312-f7eb-73c4-9351-2a6ea25e4fcc'
export const walkId = '019fc320-aaaa-73c4-9351-2a6ea25e4f01'
export const dogId1 = '019fc313-aaaa-73c4-9351-2a6ea25e4f01'
export const dogId2 = '019fc313-cccc-73c4-9351-2a6ea25e4f03'
export const startKey = 'idem-start-1'
export const finishKey = 'idem-finish-1'
export const startHash = 'hash-start-1'
export const finishHash = 'hash-finish-1'

export const recordingWalkRow = {
  walkId, ownerId, state: 'recording' as const, startedAt, completedAt: null, createdAt: startedAt, updatedAt: startedAt,
}
export const completedWalkRow = {
  walkId, ownerId, state: 'completed' as const, startedAt, completedAt, distanceMeters: 0, createdAt: startedAt, updatedAt: completedAt,
}
export const failedWalkRow = {
  walkId, ownerId, state: 'failed' as const, startedAt, completedAt: null, createdAt: startedAt, updatedAt: startedAt,
}
export const failInput = { ownerId, walkId }
export const participantRow1 = {
  walkParticipantId: '019fc321-aaaa-73c4-9351-2a6ea25e4f01', walkId, dogId: dogId1, name: 'Mugi', position: 0, createdAt: startedAt,
}
export const participantRow2 = {
  walkParticipantId: '019fc321-bbbb-73c4-9351-2a6ea25e4f02', walkId, dogId: dogId2, name: 'Sora', position: 1, createdAt: startedAt,
}
const expectedParticipants = [
  { walkParticipantId: participantRow1.walkParticipantId, dogId: dogId1, name: 'Mugi' },
  { walkParticipantId: participantRow2.walkParticipantId, dogId: dogId2, name: 'Sora' },
]
export const expectedRecordingWalk = {
  walkId, ownerId, state: 'recording' as const, startedAt, completedAt: null, participants: expectedParticipants,
}
export const expectedCompletedWalk = {
  walkId, ownerId, state: 'completed' as const, startedAt, completedAt,
  durationSeconds: 630, distanceMeters: 0, paceSecondsPerMeter: null, participants: expectedParticipants,
}
export const startInput = { ownerId, participantDogIds: [dogId1, dogId2], idempotencyKey: startKey, bodyHash: startHash }
export const finishInput = { ownerId, walkId, idempotencyKey: finishKey, bodyHash: finishHash, distanceMeters: 0 }
export const ownedDogs = [{ dogId: dogId1, name: 'Mugi' }, { dogId: dogId2, name: 'Sora' }]
export const startCommandKeyRow = {
  walkCommandKeyId: '019fc322-aaaa-73c4-9351-2a6ea25e4f01', ownerId, namespace: 'start' as const,
  key: startKey, bodyHash: startHash, walkId, createdAt: startedAt,
}
export const finishCommandKeyRow = {
  walkCommandKeyId: '019fc322-bbbb-73c4-9351-2a6ea25e4f02', ownerId, namespace: 'finish' as const,
  key: finishKey, bodyHash: finishHash, walkId, createdAt: startedAt,
}
export const commandKeyUnique = uniqueViolation('walk_command_keys_owner_id_namespace_key_unique')

export const recordedAt = new Date('2026-08-17T03:12:14.000Z')
export const trackPointInput = {
  ownerId,
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}
export const trackPointRow = {
  trackPointId: '0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90',
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
  createdAt: recordedAt,
}
export const expectedTrackPoint = {
  trackPointId: trackPointRow.trackPointId,
  walkId,
  recordedAt,
  latitude: 35.681236,
  longitude: 139.767125,
}
export const trackPointUnique = uniqueViolation('walk_track_points_walk_id_recorded_at_unique')
