import type { TrackPoint } from './types.js'

export interface TrackPointQueue {
  enqueue(trackPoint: TrackPoint): Promise<void>
}

export interface ConfirmTrackPoint {
  confirm(trackPoint: TrackPoint): Promise<void>
}

export type ConfirmedTrackPoints = {
  listRecordedAt(walkId: string): Promise<Date[]>
}
