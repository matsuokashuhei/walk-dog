import type { CompletedWalk, RecordingWalk, WalkParticipant } from './types.js'

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
