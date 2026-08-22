import type { Latitude, Longitude } from '../../infrastructure/database/schema/walk-track-point.js'

export type WalkParticipant = {
  walkParticipantId: string
  dogId: string
  name: string
}

export type RecordingWalk = {
  walkId: string
  ownerId: string
  state: 'recording'
  startedAt: Date
  completedAt: null
  participants: WalkParticipant[]
}

export type CompletedWalk = {
  walkId: string
  ownerId: string
  state: 'completed'
  startedAt: Date
  completedAt: Date
  durationSeconds: number
  distanceMeters: 0
  paceSecondsPerMeter: null
  participants: WalkParticipant[]
}

export type CommandNamespace = 'start' | 'finish'

export type StartWalkInput = {
  ownerId: string
  participantDogIds: string[]
  idempotencyKey: string
  bodyHash: string
}

export type FinishWalkInput = {
  ownerId: string
  walkId: string
  idempotencyKey: string
  bodyHash: string
}

export type TrackPoint = {
  trackPointId: string
  walkId: string
  recordedAt: Date
  latitude: Latitude
  longitude: Longitude
}

export type AcceptTrackPointInput = {
  ownerId: string
  walkId: string
  recordedAt: Date
  latitude: Latitude
  longitude: Longitude
}

export type GetActiveWalk = (cognitoSubject: string) => Promise<RecordingWalk | null>

export type StartWalk = (input: {
  cognitoSubject: string
  participantDogIds: string[]
  idempotencyKey: string
}) => Promise<
  | { ok: true; walk: RecordingWalk }
  | { ok: false; error: 'not_found' | 'active_walk_exists' | 'idempotency_conflict' }
>

export type FinishWalk = (input: {
  cognitoSubject: string
  walkId: string
  idempotencyKey: string
}) => Promise<
  | { ok: true; walk: CompletedWalk }
  | { ok: false; error: 'not_found' | 'walk_not_recording' | 'idempotency_conflict' }
>

export type DeleteWalk = (input: {
  cognitoSubject: string
  walkId: string
}) => Promise<
  | { ok: true }
  | { ok: false; error: 'not_found' | 'walk_not_recording' }
>
