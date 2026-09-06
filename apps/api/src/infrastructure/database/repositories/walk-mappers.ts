import { paceSecondsPerMeter } from '../../../modules/walks/path-distance.js'
import type {
  CompletedWalk,
  RecordingWalk,
  WalkEvent,
  WalkParticipant,
} from '../../../modules/walks/types.js'
import { walkEvents } from '../schema/walk-event.js'
import { walkParticipants } from '../schema/walk-participant.js'
import { walks } from '../schema/walk.js'

type WalkRow = typeof walks.$inferSelect
type WalkParticipantRow = typeof walkParticipants.$inferSelect

export function toRecordingWalk(walk: WalkRow, participantRows: WalkParticipantRow[]): RecordingWalk {
  return {
    walkId: walk.walkId,
    ownerId: walk.ownerId,
    state: 'recording',
    startedAt: walk.startedAt,
    completedAt: null,
    participants: participantRows.map(toParticipant),
  }
}

export function toCompletedWalk(walk: WalkRow, participantRows: WalkParticipantRow[]): CompletedWalk {
  const completedAt = walk.completedAt as Date
  const durationSeconds = Math.floor((completedAt.getTime() - walk.startedAt.getTime()) / 1000)
  const distanceMeters = walk.distanceMeters ?? 0
  return {
    walkId: walk.walkId,
    ownerId: walk.ownerId,
    state: 'completed',
    startedAt: walk.startedAt,
    completedAt,
    durationSeconds,
    distanceMeters,
    paceSecondsPerMeter: paceSecondsPerMeter(durationSeconds, distanceMeters),
    participants: participantRows.map(toParticipant),
  }
}

function toParticipant(row: WalkParticipantRow): WalkParticipant {
  return { walkParticipantId: row.walkParticipantId, dogId: row.dogId, name: row.name }
}

export function toWalkEvent(row: typeof walkEvents.$inferSelect): WalkEvent {
  return {
    eventId: row.eventId,
    walkId: row.walkId,
    participantDogId: row.participantDogId,
    type: row.type,
    occurredAt: row.occurredAt,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}
