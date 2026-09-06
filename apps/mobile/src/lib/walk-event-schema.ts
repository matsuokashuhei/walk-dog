import { z } from 'zod'

export const walkEventTypeSchema = z.enum(['pee', 'poop', 'sniff', 'greet'])

export type WalkEventType = z.infer<typeof walkEventTypeSchema>

export const localWalkEventSchema = z.object({
  eventId: z.uuid(),
  walkId: z.uuid(),
  participantDogId: z.uuid(),
  type: walkEventTypeSchema,
  occurredAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
})

export type LocalWalkEvent = z.infer<typeof localWalkEventSchema>

export function toLocalWalkEvent(input: LocalWalkEvent): LocalWalkEvent {
  return localWalkEventSchema.parse({
    ...input,
    latitude: Math.round(input.latitude * 1_000_000) / 1_000_000,
    longitude: Math.round(input.longitude * 1_000_000) / 1_000_000,
  })
}

export const walkEventResponseSchema = z.object({
  requestId: z.string(),
  eventId: z.uuid(),
  walkId: z.uuid(),
  participantDogId: z.uuid(),
  type: walkEventTypeSchema,
  occurredAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
})

export type WalkEventResponse = z.infer<typeof walkEventResponseSchema>
