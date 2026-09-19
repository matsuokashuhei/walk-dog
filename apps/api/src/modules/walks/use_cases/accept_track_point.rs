//! Accept a track point on a recording walk and enqueue confirmation.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::provider::TrackPointQueue;
use crate::modules::walks::repository::{AcceptTrackPointError, WalkRepository};
use crate::modules::walks::types::{AcceptTrackPointInput, TrackPoint};

pub struct AcceptTrackPointDeps<'a> {
    pub owners: &'a dyn OwnerRepository,
    pub walks: &'a dyn WalkRepository,
    pub queue: &'a dyn TrackPointQueue,
}

pub enum AcceptTrackPointResult {
    Accepted(TrackPoint),
    NotFound,
    NotRecording,
    IdempotencyConflict,
    EnqueueFailed,
}

pub async fn accept_track_point(
    deps: AcceptTrackPointDeps<'_>,
    cognito_subject: &str,
    walk_id: &str,
    recorded_at: jiff::Timestamp,
    latitude: f64,
    longitude: f64,
) -> AcceptTrackPointResult {
    let owner = deps.owners.resolve_by_cognito_subject(cognito_subject).await;
    let track_point = match deps
        .walks
        .accept_track_point(&AcceptTrackPointInput {
            owner_id: owner.owner_id,
            walk_id: walk_id.to_string(),
            recorded_at,
            latitude,
            longitude,
        })
        .await
    {
        Ok(point) => point,
        Err(AcceptTrackPointError::NotFound(_)) => return AcceptTrackPointResult::NotFound,
        Err(AcceptTrackPointError::NotRecording(_)) => {
            return AcceptTrackPointResult::NotRecording;
        }
        Err(AcceptTrackPointError::IdempotencyConflict(_)) => {
            return AcceptTrackPointResult::IdempotencyConflict;
        }
    };
    if deps.queue.enqueue(&track_point).await.is_err() {
        return AcceptTrackPointResult::EnqueueFailed;
    }
    AcceptTrackPointResult::Accepted(track_point)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::errors::{
        IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
    };
    use crate::modules::walks::repository::{
        FailWalkError, FinishWalkError, ListAcceptedError, StartWalkError,
    };
    use crate::modules::walks::types::{
        CompletedWalk, FinishWalkInput, RecordingWalk, StartWalkInput, WalkEvent,
    };
    use std::sync::Mutex;

    fn sample_owner() -> Owner {
        Owner {
            owner_id: "owner-1".into(),
            display_name: None,
            avatar_url: None,
            created_at: jiff::Timestamp::from_second(1).unwrap(),
            updated_at: jiff::Timestamp::from_second(1).unwrap(),
        }
    }

    fn sample_point() -> TrackPoint {
        TrackPoint {
            track_point_id: "tp-1".into(),
            walk_id: "walk-1".into(),
            recorded_at: "2026-08-17T12:00:00Z".parse().unwrap(),
            latitude: 35.681_236,
            longitude: 139.767_125,
        }
    }

    struct FakeOwners;
    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, _: &str) -> Owner {
            sample_owner()
        }
        async fn update_display_name(&self, _: &str, _: &str) -> Owner {
            unreachable!()
        }
    }

    struct FakeWalks {
        result: Mutex<Result<TrackPoint, AcceptTrackPointError>>,
        calls: Mutex<Vec<AcceptTrackPointInput>>,
    }

    #[async_trait::async_trait]
    impl WalkRepository for FakeWalks {
        async fn get_active_by_owner(&self, _: &str) -> Option<RecordingWalk> {
            unreachable!()
        }
        async fn get_completed_by_owner(
            &self,
            _: &str,
            _: &str,
        ) -> Result<CompletedWalk, WalkNotFoundError> {
            unreachable!()
        }
        async fn start(&self, _: &StartWalkInput) -> Result<RecordingWalk, StartWalkError> {
            unreachable!()
        }
        async fn finish(&self, _: &FinishWalkInput) -> Result<CompletedWalk, FinishWalkError> {
            unreachable!()
        }
        async fn fail(&self, _: &str, _: &str) -> Result<(), FailWalkError> {
            unreachable!()
        }
        async fn fail_if_present(&self, _: &str) {}
        async fn accept_track_point(
            &self,
            input: &AcceptTrackPointInput,
        ) -> Result<TrackPoint, AcceptTrackPointError> {
            self.calls.lock().unwrap().push(input.clone());
            self.result.lock().unwrap().clone()
        }
        async fn record_event(
            &self,
            _: &crate::modules::walks::types::RecordEventInput,
        ) -> Result<
            crate::modules::walks::types::RecordedEvent,
            crate::modules::walks::repository::RecordEventError,
        > {
            unreachable!()
        }
        async fn list_accepted_recorded_at(
            &self,
            _: &str,
            _: &str,
        ) -> Result<Vec<jiff::Timestamp>, ListAcceptedError> {
            unreachable!()
        }
        async fn list_accepted_track_points(
            &self,
            _: &str,
            _: &str,
        ) -> Result<Vec<crate::modules::walks::types::TrackPoint>, crate::modules::walks::repository::ListAcceptedError> {
            unreachable!()
        }

        async fn list_events(&self, _: &str) -> Vec<WalkEvent> {
            unreachable!()
        }
    }

    struct FakeQueue {
        enqueued: Mutex<Vec<TrackPoint>>,
        fail: Mutex<bool>,
    }

    #[async_trait::async_trait]
    impl TrackPointQueue for FakeQueue {
        async fn enqueue(&self, track_point: &TrackPoint) -> Result<(), ()> {
            if *self.fail.lock().unwrap() {
                return Err(());
            }
            self.enqueued.lock().unwrap().push(track_point.clone());
            Ok(())
        }
    }

    fn deps<'a>(walks: &'a FakeWalks, queue: &'a FakeQueue) -> AcceptTrackPointDeps<'a> {
        AcceptTrackPointDeps {
            owners: &FakeOwners,
            walks,
            queue,
        }
    }

    #[tokio::test]
    async fn accepts_and_enqueues() {
        let point = sample_point();
        let walks = FakeWalks {
            result: Mutex::new(Ok(point.clone())),
            calls: Mutex::new(vec![]),
        };
        let queue = FakeQueue {
            enqueued: Mutex::new(vec![]),
            fail: Mutex::new(false),
        };
        let result = accept_track_point(
            deps(&walks, &queue),
            "sub",
            "walk-1",
            point.recorded_at,
            point.latitude,
            point.longitude,
        )
        .await;
        assert!(matches!(result, AcceptTrackPointResult::Accepted(_)));
        assert_eq!(queue.enqueued.lock().unwrap().len(), 1);
        assert_eq!(walks.calls.lock().unwrap()[0].owner_id, "owner-1");
    }

    #[tokio::test]
    async fn maps_not_found_without_enqueue() {
        let walks = FakeWalks {
            result: Mutex::new(Err(AcceptTrackPointError::NotFound(WalkNotFoundError))),
            calls: Mutex::new(vec![]),
        };
        let queue = FakeQueue {
            enqueued: Mutex::new(vec![]),
            fail: Mutex::new(false),
        };
        let result = accept_track_point(
            deps(&walks, &queue),
            "sub",
            "walk-1",
            "2026-08-17T12:00:00Z".parse().unwrap(),
            35.0,
            139.0,
        )
        .await;
        assert!(matches!(result, AcceptTrackPointResult::NotFound));
        assert!(queue.enqueued.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn maps_not_recording() {
        let walks = FakeWalks {
            result: Mutex::new(Err(AcceptTrackPointError::NotRecording(
                WalkNotRecordingError,
            ))),
            calls: Mutex::new(vec![]),
        };
        let queue = FakeQueue {
            enqueued: Mutex::new(vec![]),
            fail: Mutex::new(false),
        };
        let result = accept_track_point(
            deps(&walks, &queue),
            "sub",
            "walk-1",
            "2026-08-17T12:00:00Z".parse().unwrap(),
            35.0,
            139.0,
        )
        .await;
        assert!(matches!(result, AcceptTrackPointResult::NotRecording));
    }

    #[tokio::test]
    async fn maps_idempotency_conflict() {
        let walks = FakeWalks {
            result: Mutex::new(Err(AcceptTrackPointError::IdempotencyConflict(
                IdempotencyConflictError,
            ))),
            calls: Mutex::new(vec![]),
        };
        let queue = FakeQueue {
            enqueued: Mutex::new(vec![]),
            fail: Mutex::new(false),
        };
        let result = accept_track_point(
            deps(&walks, &queue),
            "sub",
            "walk-1",
            "2026-08-17T12:00:00Z".parse().unwrap(),
            35.0,
            139.0,
        )
        .await;
        assert!(matches!(
            result,
            AcceptTrackPointResult::IdempotencyConflict
        ));
    }

    #[tokio::test]
    async fn maps_enqueue_failure() {
        let walks = FakeWalks {
            result: Mutex::new(Ok(sample_point())),
            calls: Mutex::new(vec![]),
        };
        let queue = FakeQueue {
            enqueued: Mutex::new(vec![]),
            fail: Mutex::new(true),
        };
        let result = accept_track_point(
            deps(&walks, &queue),
            "sub",
            "walk-1",
            "2026-08-17T12:00:00Z".parse().unwrap(),
            35.0,
            139.0,
        )
        .await;
        assert!(matches!(result, AcceptTrackPointResult::EnqueueFailed));
    }
}
