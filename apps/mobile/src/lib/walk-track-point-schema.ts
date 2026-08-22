import { z } from 'zod'

export const localTrackPointSchema = z.strictObject({
  walkId: z.uuid(),
  recordedAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90).multipleOf(0.000001),
  longitude: z.number().gte(-180).lte(180).multipleOf(0.000001),
})

export type LocalTrackPoint = z.infer<typeof localTrackPointSchema>

export const trackPointResponseSchema = z.strictObject({
  requestId: z.string(),
  trackPointId: z.uuid(),
  ...localTrackPointSchema.shape,
})

export type TrackPointResponse = z.infer<typeof trackPointResponseSchema>
