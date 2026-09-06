import { apiRequest } from './api.ts'
import type { WalkEventResponse, WalkEventType } from './walk-event-schema.ts'
import type { LocalTrackPoint } from './walk-track-point-schema.ts'

export {
  localWalkEventSchema,
  toLocalWalkEvent,
  walkEventResponseSchema,
  walkEventTypeSchema,
} from './walk-event-schema.ts'
export type {
  LocalWalkEvent,
  WalkEventResponse,
  WalkEventType,
} from './walk-event-schema.ts'
export {
  localTrackPointSchema,
  toLocalTrackPoint,
  trackPointResponseSchema,
} from './walk-track-point-schema.ts'
export type { LocalTrackPoint, TrackPointResponse } from './walk-track-point-schema.ts'

export type WalkParticipantResponse = {
  walkParticipantId: string
  dogId: string
  name: string
}

export type RecordingWalkResponse = {
  requestId: string
  walkId: string
  ownerId: string
  state: 'recording'
  startedAt: string
  completedAt: null
  participants: WalkParticipantResponse[]
}

export type CompletedWalkResponse = {
  requestId: string
  walkId: string
  ownerId: string
  state: 'completed'
  startedAt: string
  completedAt: string
  durationSeconds: number
  distanceMeters: number
  paceSecondsPerMeter: number | null
  participants: WalkParticipantResponse[]
}

export type WalkDetailTrackPointResponse = {
  recordedAt: string
  latitude: number
  longitude: number
}

export type WalkDetailEventResponse = {
  eventId: string
  participantDogId: string
  type: WalkEventType
  occurredAt: string
  latitude: number
  longitude: number
}

export type WalkDetailResponse = CompletedWalkResponse & {
  trackPoints: WalkDetailTrackPointResponse[]
  events: WalkDetailEventResponse[]
}

export type PostEventBody = {
  eventId: string
  participantDogId: string
  type: WalkEventType
  occurredAt: string
  latitude: number
  longitude: number
}

export async function getActiveWalk(accessToken: string): Promise<RecordingWalkResponse | null> {
  const walk = await apiRequest<RecordingWalkResponse | undefined>('/v1/walks/active', {
    accessToken,
  })
  return walk ?? null
}

export function startWalk(
  accessToken: string,
  input: { participantDogIds: string[]; idempotencyKey: string },
): Promise<RecordingWalkResponse> {
  return apiRequest<RecordingWalkResponse>('/v1/walks', {
    method: 'POST',
    accessToken,
    body: { participantDogIds: input.participantDogIds },
    headers: { 'Idempotency-Key': input.idempotencyKey },
  })
}

export function finishWalk(
  accessToken: string,
  input: { walkId: string; idempotencyKey: string },
): Promise<CompletedWalkResponse> {
  return apiRequest<CompletedWalkResponse>(`/v1/walks/${input.walkId}/finish`, {
    method: 'POST',
    accessToken,
    body: {},
    headers: { 'Idempotency-Key': input.idempotencyKey },
  })
}

export async function deleteWalk(accessToken: string, walkId: string): Promise<void> {
  await apiRequest(`/v1/walks/${walkId}`, {
    method: 'DELETE',
    accessToken,
  })
}

export function getWalkDetail(accessToken: string, walkId: string): Promise<WalkDetailResponse> {
  return apiRequest<WalkDetailResponse>(`/v1/walks/${walkId}`, {
    accessToken,
  })
}

export function postEvent(
  accessToken: string,
  walkId: string,
  body: PostEventBody,
): Promise<WalkEventResponse> {
  return apiRequest<WalkEventResponse>(`/v1/walks/${walkId}/events`, {
    method: 'POST',
    accessToken,
    body: {
      eventId: body.eventId,
      participantDogId: body.participantDogId,
      type: body.type,
      occurredAt: body.occurredAt,
      latitude: body.latitude,
      longitude: body.longitude,
    },
  })
}

export async function postTrackPoint(
  accessToken: string,
  input: LocalTrackPoint,
): Promise<void> {
  await apiRequest(`/v1/walks/${input.walkId}/track-points`, {
    method: 'POST',
    accessToken,
    body: {
      recordedAt: input.recordedAt,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  })
}
