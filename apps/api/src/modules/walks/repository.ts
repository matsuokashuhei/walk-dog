import type { CompletedWalk, FinishWalkInput, RecordingWalk, StartWalkInput } from './types.js'

export interface WalkRepository {
  getActiveByOwner(ownerId: string): Promise<RecordingWalk | null>
  start(input: StartWalkInput): Promise<RecordingWalk>
  finish(input: FinishWalkInput): Promise<CompletedWalk>
  failIfPresent(input: { ownerId: string }): Promise<void>
}
