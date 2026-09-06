import { z } from 'zod'
import {
  latitudeSchema,
  longitudeSchema,
} from '../../infrastructure/database/schema/walk-track-point.js'
import { errorSchema } from '../../shared/http/error-contract.js'

export { errorSchema as walkErrorSchema }

export const startWalkRequestSchema = z.strictObject({
  participantDogIds: z.array(z.uuid()).min(1).refine(
    (ids) => new Set(ids).size === ids.length,
    { message: 'duplicate' },
  ),
})

export const finishWalkRequestSchema = z.strictObject({})

export const acceptTrackPointRequestSchema = z.strictObject({
  recordedAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90).pipe(latitudeSchema),
  longitude: z.number().gte(-180).lte(180).pipe(longitudeSchema),
})

export const walkEventTypeSchema = z.enum(['pee', 'poop', 'sniff', 'greet'])

export const recordEventRequestSchema = z.strictObject({
  eventId: z.uuid(),
  participantDogId: z.uuid(),
  type: walkEventTypeSchema,
  occurredAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90).pipe(latitudeSchema),
  longitude: z.number().gte(-180).lte(180).pipe(longitudeSchema),
})

export const walkIdParamSchema = z.object({
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
  distanceMeters: z.number().int().nonnegative(),
  paceSecondsPerMeter: z.number().nullable(),
  participants: z.array(walkParticipantSchema),
})

export const recordingWalkResponseSchema = recordingWalkSchema.extend({
  requestId: z.string(),
})

export const completedWalkResponseSchema = completedWalkSchema.extend({
  requestId: z.string(),
})

const walkDetailTrackPointSchema = z.object({
  recordedAt: acceptTrackPointRequestSchema.shape.recordedAt,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
})

const walkDetailEventSchema = z.object({
  eventId: recordEventRequestSchema.shape.eventId,
  participantDogId: recordEventRequestSchema.shape.participantDogId,
  type: walkEventTypeSchema,
  occurredAt: recordEventRequestSchema.shape.occurredAt,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
})

export const walkDetailResponseSchema = completedWalkResponseSchema.extend({
  trackPoints: z.array(walkDetailTrackPointSchema),
  events: z.array(walkDetailEventSchema),
})

export const trackPointResponseSchema = z.strictObject({
  requestId: errorSchema.shape.requestId,
  trackPointId: z.uuid(),
  walkId: walkIdParamSchema.shape.walkId,
  recordedAt: acceptTrackPointRequestSchema.shape.recordedAt,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
})

export const eventResponseSchema = z.strictObject({
  requestId: errorSchema.shape.requestId,
  eventId: recordEventRequestSchema.shape.eventId,
  walkId: walkIdParamSchema.shape.walkId,
  participantDogId: recordEventRequestSchema.shape.participantDogId,
  type: walkEventTypeSchema,
  occurredAt: recordEventRequestSchema.shape.occurredAt,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
})
