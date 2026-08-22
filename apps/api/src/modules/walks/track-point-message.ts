import { z } from 'zod'
import type { TrackPoint } from './types.js'

const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
})

const trackPointMessage = z.strictObject({
  trackPointId: z.string(),
  walkId: z.string(),
  recordedAt: isoDatetimeToDate,
  latitude: z.number(),
  longitude: z.number(),
})

export function toTrackPointMessage(trackPoint: TrackPoint): string {
  return JSON.stringify(trackPointMessage.encode(trackPoint))
}

export function parseTrackPointMessage(body: string): TrackPoint {
  const parsed: unknown = JSON.parse(body)
  return trackPointMessage.parse(parsed)
}
