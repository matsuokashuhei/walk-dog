import { z } from 'zod'

export const localTrackPointSchema = z.object({
  walkId: z.uuid(),
  recordedAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
})

export type LocalTrackPoint = z.infer<typeof localTrackPointSchema>

export function toLocalTrackPoint(input: LocalTrackPoint): LocalTrackPoint {
  return localTrackPointSchema.parse({
    ...input,
    latitude: Math.round(input.latitude * 1_000_000) / 1_000_000,
    longitude: Math.round(input.longitude * 1_000_000) / 1_000_000,
  })
}

export const trackPointResponseSchema = z.object({
  requestId: z.string(),
  trackPointId: z.uuid(),
  walkId: z.uuid(),
  recordedAt: z.iso.datetime(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
})

export type TrackPointResponse = z.infer<typeof trackPointResponseSchema>
