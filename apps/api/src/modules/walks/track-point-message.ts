import type { TrackPoint } from './types.js'

export function toTrackPointMessage(trackPoint: TrackPoint): string {
  return JSON.stringify({
    trackPointId: trackPoint.trackPointId,
    walkId: trackPoint.walkId,
    recordedAt: trackPoint.recordedAt.toISOString(),
    latitude: trackPoint.latitude,
    longitude: trackPoint.longitude,
  })
}

export function parseTrackPointMessage(body: string): TrackPoint {
  const parsed = JSON.parse(body) as Record<string, unknown>
  if (
    typeof parsed.trackPointId !== 'string'
    || typeof parsed.walkId !== 'string'
    || typeof parsed.recordedAt !== 'string'
    || typeof parsed.latitude !== 'number'
    || typeof parsed.longitude !== 'number'
  ) {
    throw new Error('invalid track point message')
  }
  return {
    trackPointId: parsed.trackPointId,
    walkId: parsed.walkId,
    recordedAt: new Date(parsed.recordedAt),
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  }
}
