import { apiRequest } from '@/lib/api'
import { z } from 'zod'

export const localTrackPointSchema = z.strictObject({
  walkId: z.uuid(),
  recordedAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90).multipleOf(0.000001),
  longitude: z.number().gte(-180).lte(180).multipleOf(0.000001),
})

export type LocalTrackPoint = z.infer<typeof localTrackPointSchema>

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
