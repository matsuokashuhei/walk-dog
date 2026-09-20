//! Walk provider traits — SQS queue, Dynamo confirm/list.

use crate::modules::walks::types::{ConfirmedTrackPoint, TrackPoint};

#[async_trait::async_trait]
pub trait TrackPointQueue: Send + Sync {
    async fn enqueue(&self, track_point: &TrackPoint) -> Result<(), ()>;
}

#[async_trait::async_trait]
pub trait ConfirmTrackPoint: Send + Sync {
    async fn confirm(&self, track_point: &TrackPoint) -> Result<(), ()>;
}

#[async_trait::async_trait]
pub trait ConfirmedTrackPoints: Send + Sync {
    async fn list_points(&self, walk_id: &str) -> Result<Vec<ConfirmedTrackPoint>, ()>;
    async fn list_recorded_at(&self, walk_id: &str) -> Result<Vec<jiff::Timestamp>, ()>;
}
