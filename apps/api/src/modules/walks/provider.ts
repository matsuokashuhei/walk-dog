import type { TrackPoint } from './types.js'

export interface TrackPointQueue {
  enqueue(trackPoint: TrackPoint): Promise<void>
}
