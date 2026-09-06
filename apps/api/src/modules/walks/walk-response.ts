import type { z } from 'zod'
import { eventResponseSchema, trackPointResponseSchema } from './contracts.js'
import type { CompletedWalk, RecordingWalk, TrackPoint, WalkEvent, WalkParticipant } from './types.js'

function toParticipantFields(participant: WalkParticipant) {
  return {
    walkParticipantId: participant.walkParticipantId,
    dogId: participant.dogId,
    name: participant.name,
  }
}

export function toRecordingWalkResponse(requestId: string, walk: RecordingWalk) {
  return {
    requestId,
    walkId: walk.walkId,
    ownerId: walk.ownerId,
    state: walk.state,
    startedAt: walk.startedAt.toISOString(),
    completedAt: null,
    participants: walk.participants.map(toParticipantFields),
  }
}

export function toCompletedWalkResponse(requestId: string, walk: CompletedWalk) {
  return {
    requestId,
    walkId: walk.walkId,
    ownerId: walk.ownerId,
    state: walk.state,
    startedAt: walk.startedAt.toISOString(),
    completedAt: walk.completedAt.toISOString(),
    durationSeconds: walk.durationSeconds,
    distanceMeters: walk.distanceMeters,
    paceSecondsPerMeter: walk.paceSecondsPerMeter,
    participants: walk.participants.map(toParticipantFields),
  }
}

export function toTrackPointResponse(
  requestId: string,
  trackPoint: TrackPoint,
): z.infer<typeof trackPointResponseSchema> {
  return {
    requestId,
    trackPointId: trackPoint.trackPointId,
    walkId: trackPoint.walkId,
    recordedAt: trackPoint.recordedAt.toISOString(),
    latitude: trackPoint.latitude,
    longitude: trackPoint.longitude,
  }
}

export function toEventResponse(
  requestId: string,
  event: WalkEvent,
): z.infer<typeof eventResponseSchema> {
  return {
    requestId,
    eventId: event.eventId,
    walkId: event.walkId,
    participantDogId: event.participantDogId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    latitude: event.latitude,
    longitude: event.longitude,
  }
}
