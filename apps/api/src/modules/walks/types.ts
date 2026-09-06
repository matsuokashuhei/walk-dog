import type { owners } from '../../infrastructure/database/schema/owner.js'
import type { walks } from '../../infrastructure/database/schema/walk.js'
import type { NewWalkEvent, WalkEvent as WalkEventRow } from '../../infrastructure/database/schema/walk-event.js'
import type { NewWalkTrackPoint, WalkTrackPoint } from '../../infrastructure/database/schema/walk-track-point.js'
import type { ConfirmedTrackPoint } from './provider.js'

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
  distanceMeters: number
  paceSecondsPerMeter: number | null
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
  distanceMeters: number
}

export type TrackPoint = Pick<WalkTrackPoint, 'trackPointId' | 'walkId' | 'recordedAt' | 'latitude' | 'longitude'>

export type AcceptTrackPointInput = Pick<NewWalkTrackPoint, 'walkId' | 'recordedAt' | 'latitude' | 'longitude'> & {
  ownerId: typeof walks.$inferSelect['ownerId']
}

export type EventType = WalkEventRow['type']

export type WalkEvent = Pick<
  WalkEventRow,
  'eventId' | 'walkId' | 'participantDogId' | 'type' | 'occurredAt' | 'latitude' | 'longitude'
>

export type WalkDetail = CompletedWalk & {
  trackPoints: ConfirmedTrackPoint[]
  events: WalkEvent[]
}

export type RecordEventInput = Pick<
  NewWalkEvent,
  'eventId' | 'walkId' | 'participantDogId' | 'type' | 'occurredAt' | 'latitude' | 'longitude'
> & {
  ownerId: typeof walks.$inferSelect['ownerId']
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

export type FinishWalkClock = {
  now(): number
}

export type FinishWalkSleep = {
  sleep(delayMs: number): Promise<void>
}

export type FinishWalk = (input: {
  cognitoSubject: string
  walkId: string
  idempotencyKey: string
}) => Promise<
  | { ok: true; walk: CompletedWalk }
  | {
      ok: false
      error:
        | 'not_found'
        | 'walk_not_recording'
        | 'idempotency_conflict'
        | 'service_unavailable'
    }
>

export type DeleteWalk = (input: {
  cognitoSubject: string
  walkId: string
}) => Promise<
  | { ok: true }
  | { ok: false; error: 'not_found' | 'walk_not_recording' }
>

export type AcceptTrackPoint = (input: {
  cognitoSubject: typeof owners.$inferSelect['cognitoSubject']
} & Pick<NewWalkTrackPoint, 'walkId' | 'recordedAt' | 'latitude' | 'longitude'>) => Promise<
  | { ok: true; trackPoint: TrackPoint }
  | { ok: false; error: 'not_found' | 'walk_not_recording' | 'idempotency_conflict' }
>

export type RecordEvent = (input: {
  cognitoSubject: typeof owners.$inferSelect['cognitoSubject']
} & Pick<
  NewWalkEvent,
  'eventId' | 'walkId' | 'participantDogId' | 'type' | 'occurredAt' | 'latitude' | 'longitude'
>) => Promise<
  | { ok: true; event: WalkEvent; created: boolean }
  | { ok: false; error: 'not_found' | 'walk_not_recording' | 'idempotency_conflict' }
>

export type GetWalkDetail = (input: {
  cognitoSubject: string
  walkId: string
}) => Promise<
  | { ok: true; detail: WalkDetail }
  | { ok: false; error: 'not_found' }
>
