import type {
  AcceptTrackPointInput,
  CompletedWalk,
  FinishWalkInput,
  RecordingWalk,
  StartWalkInput,
  TrackPoint,
} from './types.js'

export interface WalkRepository {
  getActiveByOwner(ownerId: string): Promise<RecordingWalk | null>
  start(input: StartWalkInput): Promise<RecordingWalk>
  finish(input: FinishWalkInput): Promise<CompletedWalk>
  fail(input: { ownerId: string; walkId: string }): Promise<void>
  failIfPresent(input: { ownerId: string }): Promise<void>
  acceptTrackPoint(input: AcceptTrackPointInput): Promise<TrackPoint>
  listAcceptedRecordedAt(input: { ownerId: string; walkId: string }): Promise<Date[]>
}
