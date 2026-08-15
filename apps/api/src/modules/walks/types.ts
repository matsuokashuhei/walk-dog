export type WalkState = 'recording' | 'completed' | 'failed'

export type WalkParticipant = {
  walkParticipantId: string
  dogId: string
  name: string
}

export type RecordingWalk = {
  walkId: string
  ownerId: string
  state: 'recording'
  startedAt: Date
  completedAt: null
  participants: WalkParticipant[]
}

export type CompletedWalk = {
  walkId: string
  ownerId: string
  state: 'completed'
  startedAt: Date
  completedAt: Date
  durationSeconds: number
  distanceMeters: 0
  paceSecondsPerMeter: null
  participants: WalkParticipant[]
}

export type Walk = RecordingWalk | CompletedWalk

export type CommandNamespace = 'start' | 'finish'

export type StartWalkInput = {
  ownerId: string
  participantDogIds: string[]
  idempotencyKey: string
  bodyHash: string
}

export type FinishWalkInput = {
  ownerId: string
  walkId: string
  idempotencyKey: string
  bodyHash: string
}
