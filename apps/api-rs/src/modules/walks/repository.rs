//! Walk repository trait — Phase 3a methods (active / start / fail).

use crate::modules::walks::errors::{
    ActiveWalkExistsError, IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
};
use crate::modules::walks::types::{RecordingWalk, StartWalkInput};

#[async_trait::async_trait]
pub trait WalkRepository: Send + Sync {
    async fn get_active_by_owner(&self, owner_id: &str) -> Option<RecordingWalk>;

    async fn start(
        &self,
        input: &StartWalkInput,
    ) -> Result<RecordingWalk, StartWalkError>;

    async fn fail(&self, owner_id: &str, walk_id: &str) -> Result<(), FailWalkError>;

    async fn fail_if_present(&self, owner_id: &str);
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum StartWalkError {
    #[error(transparent)]
    ActiveWalkExists(#[from] ActiveWalkExistsError),
    #[error(transparent)]
    IdempotencyConflict(#[from] IdempotencyConflictError),
    #[error(transparent)]
    NotFound(#[from] WalkNotFoundError),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum FailWalkError {
    #[error(transparent)]
    NotFound(#[from] WalkNotFoundError),
    #[error(transparent)]
    NotRecording(#[from] WalkNotRecordingError),
}
