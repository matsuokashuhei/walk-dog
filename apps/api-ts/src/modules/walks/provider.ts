import type { TrackPoint } from './types.js'

export interface TrackPointQueue {
  enqueue(trackPoint: TrackPoint): Promise<void>
}

export interface ConfirmTrackPoint {
  confirm(trackPoint: TrackPoint): Promise<void>
}

export type ConfirmedTrackPoint = {
  recordedAt: Date
  latitude: number
  longitude: number
}

export type ConfirmedTrackPoints = {
  listPoints(walkId: string): Promise<ConfirmedTrackPoint[]>
  listRecordedAt(walkId: string): Promise<Date[]>
}
