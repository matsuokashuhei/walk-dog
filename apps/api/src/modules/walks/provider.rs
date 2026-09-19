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

pub trait FinishWalkClock: Send + Sync {
    fn now_ms(&self) -> u64;
}

pub trait FinishWalkSleep: Send + Sync {
    fn sleep(
        &self,
        delay_ms: u64,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>>;
}

pub struct SystemFinishWalkClock;

impl FinishWalkClock for SystemFinishWalkClock {
    fn now_ms(&self) -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_millis() as u64
    }
}

pub struct TokioFinishWalkSleep;

impl FinishWalkSleep for TokioFinishWalkSleep {
    fn sleep(
        &self,
        delay_ms: u64,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        })
    }
}
