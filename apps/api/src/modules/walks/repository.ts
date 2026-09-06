import type {
  AcceptTrackPointInput,
  CompletedWalk,
  FinishWalkInput,
  RecordEventInput,
  RecordingWalk,
  StartWalkInput,
  TrackPoint,
  WalkEvent,
} from './types.js'

export interface WalkRepository {
  getActiveByOwner(ownerId: string): Promise<RecordingWalk | null>
  getCompletedByOwner(input: { ownerId: string; walkId: string }): Promise<CompletedWalk>
  start(input: StartWalkInput): Promise<RecordingWalk>
  finish(input: FinishWalkInput): Promise<CompletedWalk>
  fail(input: { ownerId: string; walkId: string }): Promise<void>
  failIfPresent(input: { ownerId: string }): Promise<void>
  acceptTrackPoint(input: AcceptTrackPointInput): Promise<TrackPoint>
  listAcceptedRecordedAt(input: { ownerId: string; walkId: string }): Promise<Date[]>
  listEvents(input: { walkId: string }): Promise<WalkEvent[]>
  recordEvent(input: RecordEventInput): Promise<{ event: WalkEvent; created: boolean }>
}
