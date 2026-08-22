import { apiRequest } from '@/lib/api'
import { trackPointResponseSchema } from './walk-track-point-schema'
import type { LocalTrackPoint, TrackPointResponse } from './walk-track-point-schema'

export {
  localTrackPointSchema,
  trackPointResponseSchema,
  toLocalTrackPoint,
} from './walk-track-point-schema'
export type { LocalTrackPoint, TrackPointResponse } from './walk-track-point-schema'

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
  distanceMeters: 0
  paceSecondsPerMeter: null
  participants: WalkParticipantResponse[]
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

export async function postTrackPoint(
  accessToken: string,
  input: LocalTrackPoint,
): Promise<TrackPointResponse> {
  const response = await apiRequest<unknown>(`/v1/walks/${input.walkId}/track-points`, {
    method: 'POST',
    accessToken,
    body: {
      recordedAt: input.recordedAt,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  })
  return trackPointResponseSchema.parse(response)
}
