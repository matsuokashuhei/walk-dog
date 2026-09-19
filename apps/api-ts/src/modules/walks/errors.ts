export class ActiveWalkExistsError extends Error {
  readonly code = 'ACTIVE_WALK_EXISTS' as const
}
export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT' as const
}
export class WalkNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const
}
export class WalkNotRecordingError extends Error {
  readonly code = 'WALK_NOT_RECORDING' as const
}
