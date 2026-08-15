import { z } from 'zod'
import { errorSchema } from '../../shared/http/error-contract.js'

export { errorSchema as walkErrorSchema }

export const startWalkRequestSchema = z.strictObject({
  participantDogIds: z.array(z.uuid()).min(1).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'duplicate' },
  ),
})

export const finishWalkRequestSchema = z.strictObject({})

export const finishWalkParamSchema = z.object({
  walkId: z.uuid(),
})

export const idempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).max(256),
})

const walkParticipantSchema = z.object({
  walkParticipantId: z.string(),
  dogId: z.string(),
  name: z.string(),
})

const recordingWalkSchema = z.object({
  walkId: z.string(),
  ownerId: z.string(),
  state: z.literal('recording'),
  startedAt: z.string(),
  completedAt: z.null(),
  participants: z.array(walkParticipantSchema),
})

const completedWalkSchema = z.object({
  walkId: z.string(),
  ownerId: z.string(),
  state: z.literal('completed'),
  startedAt: z.string(),
  completedAt: z.string(),
  durationSeconds: z.number(),
  distanceMeters: z.literal(0),
  paceSecondsPerMeter: z.null(),
  participants: z.array(walkParticipantSchema),
})

export const recordingWalkResponseSchema = recordingWalkSchema.extend({
  requestId: z.string(),
})

export const completedWalkResponseSchema = completedWalkSchema.extend({
  requestId: z.string(),
})
