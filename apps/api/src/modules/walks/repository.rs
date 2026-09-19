//! Walk repository trait.

use crate::modules::walks::errors::{
    ActiveWalkExistsError, IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
};
use crate::modules::walks::types::{
    AcceptTrackPointInput, CompletedWalk, FinishWalkInput, RecordEventInput, RecordedEvent,
    RecordingWalk, StartWalkInput, TrackPoint, WalkEvent,
};

#[async_trait::async_trait]
pub trait WalkRepository: Send + Sync {
    async fn get_active_by_owner(&self, owner_id: &str) -> Option<RecordingWalk>;

    async fn get_completed_by_owner(
        &self,
        owner_id: &str,
        walk_id: &str,
    ) -> Result<CompletedWalk, WalkNotFoundError>;

    async fn start(&self, input: &StartWalkInput) -> Result<RecordingWalk, StartWalkError>;

    async fn finish(&self, input: &FinishWalkInput) -> Result<CompletedWalk, FinishWalkError>;

    async fn fail(&self, owner_id: &str, walk_id: &str) -> Result<(), FailWalkError>;

    async fn fail_if_present(&self, owner_id: &str);

    async fn accept_track_point(
        &self,
        input: &AcceptTrackPointInput,
    ) -> Result<TrackPoint, AcceptTrackPointError>;

    async fn record_event(
        &self,
        input: &RecordEventInput,
    ) -> Result<RecordedEvent, RecordEventError>;

    async fn list_accepted_track_points(
        &self,
        owner_id: &str,
        walk_id: &str,
    ) -> Result<Vec<TrackPoint>, ListAcceptedError>;

    async fn list_events(&self, walk_id: &str) -> Vec<WalkEvent>;
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

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum FinishWalkError {
    #[error(transparent)]
    NotFound(#[from] WalkNotFoundError),
    #[error(transparent)]
    NotRecording(#[from] WalkNotRecordingError),
    #[error(transparent)]
    IdempotencyConflict(#[from] IdempotencyConflictError),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum AcceptTrackPointError {
    #[error(transparent)]
    NotFound(#[from] WalkNotFoundError),
    #[error(transparent)]
    NotRecording(#[from] WalkNotRecordingError),
    #[error(transparent)]
    IdempotencyConflict(#[from] IdempotencyConflictError),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RecordEventError {
    #[error(transparent)]
    NotFound(#[from] WalkNotFoundError),
    #[error(transparent)]
    NotRecording(#[from] WalkNotRecordingError),
    #[error(transparent)]
    IdempotencyConflict(#[from] IdempotencyConflictError),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ListAcceptedError {
    #[error(transparent)]
    NotFound(#[from] WalkNotFoundError),
    #[error(transparent)]
    NotRecording(#[from] WalkNotRecordingError),
}
