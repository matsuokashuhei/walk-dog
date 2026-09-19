//! Walk repository / domain errors.

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("active walk already exists for this owner")]
pub struct ActiveWalkExistsError;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("idempotency key conflict")]
pub struct IdempotencyConflictError;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("walk or participant dog not found")]
pub struct WalkNotFoundError;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("walk is not recording")]
pub struct WalkNotRecordingError;
