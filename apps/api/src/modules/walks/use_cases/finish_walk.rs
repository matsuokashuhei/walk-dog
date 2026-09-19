//! Finish a recording walk after confirmed track points are available.

use sha2::{Digest, Sha256};

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::path_distance::path_distance_meters;
use crate::modules::walks::provider::{
    ConfirmedTrackPoints, FinishWalkClock, FinishWalkSleep, TrackPointQueue,
};
use crate::modules::walks::repository::{FinishWalkError, ListAcceptedError, WalkRepository};
use crate::modules::walks::types::{CompletedWalk, FinishWalkInput, TrackPoint};

pub const FINISH_CONFIRMATION_TIMEOUT_MS: u64 = 30_000;
pub const FINISH_CONFIRMATION_POLL_MS: u64 = 200;

pub struct FinishWalkDeps<'a> {
    pub owners: &'a dyn OwnerRepository,
    pub walks: &'a dyn WalkRepository,
    pub confirmed: &'a dyn ConfirmedTrackPoints,
    pub queue: &'a dyn TrackPointQueue,
    pub clock: &'a dyn FinishWalkClock,
    pub sleep: &'a dyn FinishWalkSleep,
    pub timeout_ms: u64,
}

pub enum FinishWalkResult {
    Finished(CompletedWalk),
    NotFound,
    NotRecording,
    IdempotencyConflict,
    ServiceUnavailable,
}

pub async fn finish_walk(
    deps: FinishWalkDeps<'_>,
    cognito_subject: &str,
    walk_id: &str,
    idempotency_key: &str,
) -> FinishWalkResult {
    let owner = deps.owners.resolve_by_cognito_subject(cognito_subject).await;
    let body_hash = empty_body_hash();

    let accepted = match deps
        .walks
        .list_accepted_track_points(&owner.owner_id, walk_id)
        .await
    {
        Ok(points) => points,
        Err(ListAcceptedError::NotFound(_)) => return FinishWalkResult::NotFound,
        Err(ListAcceptedError::NotRecording(_)) => Vec::new(),
    };

    if !accepted.is_empty() {
        if reenqueue_unconfirmed(deps.confirmed, deps.queue, walk_id, &accepted)
            .await
            .is_err()
        {
            return FinishWalkResult::ServiceUnavailable;
        }
        match wait_for_confirmation(
            deps.confirmed,
            deps.clock,
            deps.sleep,
            deps.timeout_ms,
            walk_id,
            &accepted
                .iter()
                .map(|point| point.recorded_at)
                .collect::<Vec<_>>(),
        )
        .await
        {
            WaitStatus::Confirmed => {}
            WaitStatus::ServiceUnavailable => return FinishWalkResult::ServiceUnavailable,
        }
    }

    let points = if accepted.is_empty() {
        Vec::new()
    } else {
        match deps.confirmed.list_points(walk_id).await {
            Ok(points) => points,
            Err(()) => return FinishWalkResult::ServiceUnavailable,
        }
    };

    let distance_meters = path_distance_meters(
        &points
            .iter()
            .map(|point| (point.latitude, point.longitude))
            .collect::<Vec<_>>(),
    );

    match deps
        .walks
        .finish(&FinishWalkInput {
            owner_id: owner.owner_id,
            walk_id: walk_id.to_string(),
            idempotency_key: idempotency_key.to_string(),
            body_hash,
            distance_meters,
        })
        .await
    {
        Ok(walk) => FinishWalkResult::Finished(walk),
        Err(FinishWalkError::NotFound(_)) => FinishWalkResult::NotFound,
        Err(FinishWalkError::NotRecording(_)) => FinishWalkResult::NotRecording,
        Err(FinishWalkError::IdempotencyConflict(_)) => FinishWalkResult::IdempotencyConflict,
    }
}

enum WaitStatus {
    Confirmed,
    ServiceUnavailable,
}

async fn reenqueue_unconfirmed(
    confirmed: &dyn ConfirmedTrackPoints,
    queue: &dyn TrackPointQueue,
    walk_id: &str,
    accepted: &[TrackPoint],
) -> Result<(), ()> {
    let confirmed_at = confirmed.list_recorded_at(walk_id).await?;
    let have: std::collections::HashSet<_> = confirmed_at.iter().copied().collect();
    for point in accepted {
        if have.contains(&point.recorded_at) {
            continue;
        }
        queue.enqueue(point).await?;
    }
    Ok(())
}

async fn wait_for_confirmation(
    confirmed: &dyn ConfirmedTrackPoints,
    clock: &dyn FinishWalkClock,
    sleep: &dyn FinishWalkSleep,
    timeout_ms: u64,
    walk_id: &str,
    accepted: &[jiff::Timestamp],
) -> WaitStatus {
    let deadline = clock.now_ms() + timeout_ms;
    let needed: std::collections::HashSet<_> = accepted.iter().copied().collect();
    loop {
        let confirmed_at = match confirmed.list_recorded_at(walk_id).await {
            Ok(times) => times,
            Err(()) => return WaitStatus::ServiceUnavailable,
        };
        let have: std::collections::HashSet<_> = confirmed_at.iter().copied().collect();
        if needed.iter().all(|key| have.contains(key)) {
            return WaitStatus::Confirmed;
        }
        if clock.now_ms() >= deadline {
            return WaitStatus::ServiceUnavailable;
        }
        sleep.sleep(FINISH_CONFIRMATION_POLL_MS).await;
    }
}

fn empty_body_hash() -> String {
    let digest = Sha256::digest(b"{}");
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::errors::{
        IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
    };
    use crate::modules::walks::repository::{
        AcceptTrackPointError, FailWalkError, StartWalkError,
    };
    use crate::modules::walks::types::{
        AcceptTrackPointInput, ConfirmedTrackPoint, RecordingWalk, StartWalkInput, WalkEvent,
        WalkParticipant,
    };
    use std::sync::atomic::{AtomicU64, Ordering};
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

    fn sample_completed() -> CompletedWalk {
        CompletedWalk {
            walk_id: "walk-1".into(),
            owner_id: "owner-1".into(),
            started_at: jiff::Timestamp::from_second(1).unwrap(),
            completed_at: jiff::Timestamp::from_second(2).unwrap(),
            duration_seconds: 1,
            distance_meters: 0,
            pace_seconds_per_meter: None,
            participants: vec![WalkParticipant {
                walk_participant_id: "wp-1".into(),
                dog_id: "dog-1".into(),
                name: "Mint".into(),
            }],
        }
    }

    fn sample_point(recorded_at: jiff::Timestamp) -> TrackPoint {
        TrackPoint {
            track_point_id: "tp-1".into(),
            walk_id: "walk-1".into(),
            recorded_at,
            latitude: 35.0,
            longitude: 139.0,
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
        accepted: Mutex<Result<Vec<TrackPoint>, ListAcceptedError>>,
        finish_result: Mutex<Result<CompletedWalk, FinishWalkError>>,
        finish_calls: Mutex<Vec<FinishWalkInput>>,
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
        async fn finish(&self, input: &FinishWalkInput) -> Result<CompletedWalk, FinishWalkError> {
            self.finish_calls.lock().unwrap().push(input.clone());
            self.finish_result.lock().unwrap().clone()
        }
        async fn fail(&self, _: &str, _: &str) -> Result<(), FailWalkError> {
            unreachable!()
        }
        async fn fail_if_present(&self, _: &str) {}
        async fn accept_track_point(
            &self,
            _: &AcceptTrackPointInput,
        ) -> Result<TrackPoint, AcceptTrackPointError> {
            unreachable!()
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
            owner_id: &str,
            walk_id: &str,
        ) -> Result<Vec<jiff::Timestamp>, ListAcceptedError> {
            Ok(self
                .list_accepted_track_points(owner_id, walk_id)
                .await?
                .into_iter()
                .map(|point| point.recorded_at)
                .collect())
        }
        async fn list_accepted_track_points(
            &self,
            _: &str,
            _: &str,
        ) -> Result<Vec<TrackPoint>, ListAcceptedError> {
            self.accepted.lock().unwrap().clone()
        }
        async fn list_events(&self, _: &str) -> Vec<WalkEvent> {
            unreachable!()
        }
    }

    struct FakeConfirmed {
        recorded_at: Mutex<Result<Vec<jiff::Timestamp>, ()>>,
        points: Mutex<Result<Vec<ConfirmedTrackPoint>, ()>>,
    }

    #[async_trait::async_trait]
    impl ConfirmedTrackPoints for FakeConfirmed {
        async fn list_points(&self, _: &str) -> Result<Vec<ConfirmedTrackPoint>, ()> {
            self.points.lock().unwrap().clone()
        }
        async fn list_recorded_at(&self, _: &str) -> Result<Vec<jiff::Timestamp>, ()> {
            self.recorded_at.lock().unwrap().clone()
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

    struct FakeClock {
        now: AtomicU64,
    }

    impl FinishWalkClock for FakeClock {
        fn now_ms(&self) -> u64 {
            self.now.load(Ordering::SeqCst)
        }
    }

    struct FakeSleep {
        clock: AtomicU64,
    }

    impl FinishWalkSleep for FakeSleep {
        fn sleep(
            &self,
            delay_ms: u64,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
            Box::pin(async move {
                self.clock.fetch_add(delay_ms, Ordering::SeqCst);
            })
        }
    }

    fn sut(
        accepted: Result<Vec<TrackPoint>, ListAcceptedError>,
        finish: Result<CompletedWalk, FinishWalkError>,
    ) -> (FakeWalks, FakeConfirmed, FakeQueue, FakeClock, FakeSleep) {
        (
            FakeWalks {
                accepted: Mutex::new(accepted),
                finish_result: Mutex::new(finish),
                finish_calls: Mutex::new(vec![]),
            },
            FakeConfirmed {
                recorded_at: Mutex::new(Ok(vec![])),
                points: Mutex::new(Ok(vec![])),
            },
            FakeQueue {
                enqueued: Mutex::new(vec![]),
                fail: Mutex::new(false),
            },
            FakeClock {
                now: AtomicU64::new(0),
            },
            FakeSleep {
                clock: AtomicU64::new(0),
            },
        )
    }

    fn deps<'a>(
        walks: &'a FakeWalks,
        confirmed: &'a FakeConfirmed,
        queue: &'a FakeQueue,
        clock: &'a FakeClock,
        sleep: &'a FakeSleep,
        timeout_ms: u64,
    ) -> FinishWalkDeps<'a> {
        FinishWalkDeps {
            owners: &FakeOwners,
            walks,
            confirmed,
            queue,
            clock,
            sleep,
            timeout_ms,
        }
    }

    #[tokio::test]
    async fn finishes_immediately_without_accepted_points() {
        let (walks, confirmed, queue, clock, sleep) = sut(Ok(vec![]), Ok(sample_completed()));
        let result = finish_walk(
            deps(&walks, &confirmed, &queue, &clock, &sleep, 30_000),
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        let calls = walks.finish_calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].distance_meters, 0);
        assert_eq!(calls[0].body_hash, empty_body_hash());
        assert!(queue.enqueued.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn treats_not_recording_accepted_list_as_empty_then_finishes() {
        let (walks, confirmed, queue, clock, sleep) = sut(
            Err(ListAcceptedError::NotRecording(WalkNotRecordingError)),
            Ok(sample_completed()),
        );
        let result = finish_walk(
            deps(&walks, &confirmed, &queue, &clock, &sleep, 30_000),
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
    }

    #[tokio::test]
    async fn maps_not_found_from_accepted_list() {
        let (walks, confirmed, queue, clock, sleep) = sut(
            Err(ListAcceptedError::NotFound(WalkNotFoundError)),
            Ok(sample_completed()),
        );
        let result = finish_walk(
            deps(&walks, &confirmed, &queue, &clock, &sleep, 30_000),
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::NotFound));
    }

    #[tokio::test]
    async fn waits_then_times_out_when_confirmation_missing() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let (walks, confirmed, queue, _clock, _sleep) =
            sut(Ok(vec![sample_point(recorded_at)]), Ok(sample_completed()));
        let clock = FakeClock {
            now: AtomicU64::new(0),
        };
        struct LinkedSleep<'a> {
            clock: &'a FakeClock,
        }
        impl FinishWalkSleep for LinkedSleep<'_> {
            fn sleep(
                &self,
                delay_ms: u64,
            ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
                Box::pin(async move {
                    self.clock.now.fetch_add(delay_ms, Ordering::SeqCst);
                })
            }
        }
        let sleep = LinkedSleep { clock: &clock };
        let result = finish_walk(
            FinishWalkDeps {
                owners: &FakeOwners,
                walks: &walks,
                confirmed: &confirmed,
                queue: &queue,
                clock: &clock,
                sleep: &sleep,
                timeout_ms: 400,
            },
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::ServiceUnavailable));
        assert!(walks.finish_calls.lock().unwrap().is_empty());
        assert_eq!(queue.enqueued.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn finishes_after_confirmation() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let point = sample_point(recorded_at);
        let (walks, confirmed, queue, clock, sleep) =
            sut(Ok(vec![point.clone()]), Ok(sample_completed()));
        *confirmed.recorded_at.lock().unwrap() = Ok(vec![recorded_at]);
        *confirmed.points.lock().unwrap() = Ok(vec![ConfirmedTrackPoint {
            recorded_at,
            latitude: 35.0,
            longitude: 139.0,
        }]);
        let result = finish_walk(
            deps(&walks, &confirmed, &queue, &clock, &sleep, 30_000),
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        assert_eq!(walks.finish_calls.lock().unwrap()[0].distance_meters, 0);
        assert!(queue.enqueued.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn reenqueues_unconfirmed_accepted_points_then_finishes() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00.123Z".parse().unwrap();
        let point = sample_point(recorded_at);
        let (walks, _confirmed, queue, clock, sleep) =
            sut(Ok(vec![point.clone()]), Ok(sample_completed()));

        struct ConfirmAfterEnqueue<'a> {
            queue: &'a FakeQueue,
            recorded_at: jiff::Timestamp,
        }
        #[async_trait::async_trait]
        impl ConfirmedTrackPoints for ConfirmAfterEnqueue<'_> {
            async fn list_points(&self, _: &str) -> Result<Vec<ConfirmedTrackPoint>, ()> {
                Ok(vec![ConfirmedTrackPoint {
                    recorded_at: self.recorded_at,
                    latitude: 35.0,
                    longitude: 139.0,
                }])
            }
            async fn list_recorded_at(&self, _: &str) -> Result<Vec<jiff::Timestamp>, ()> {
                if self.queue.enqueued.lock().unwrap().is_empty() {
                    return Ok(vec![]);
                }
                Ok(vec![self.recorded_at])
            }
        }
        let confirming = ConfirmAfterEnqueue {
            queue: &queue,
            recorded_at,
        };

        let result = finish_walk(
            FinishWalkDeps {
                owners: &FakeOwners,
                walks: &walks,
                confirmed: &confirming,
                queue: &queue,
                clock: &clock,
                sleep: &sleep,
                timeout_ms: 30_000,
            },
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        assert_eq!(queue.enqueued.lock().unwrap().as_slice(), &[point]);
    }

    #[tokio::test]
    async fn maps_enqueue_failure_during_repair_to_service_unavailable() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let (walks, confirmed, queue, clock, sleep) =
            sut(Ok(vec![sample_point(recorded_at)]), Ok(sample_completed()));
        *queue.fail.lock().unwrap() = true;
        let result = finish_walk(
            deps(&walks, &confirmed, &queue, &clock, &sleep, 30_000),
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::ServiceUnavailable));
        assert!(walks.finish_calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn maps_finish_errors() {
        let (walks, confirmed, queue, clock, sleep) = sut(
            Ok(vec![]),
            Err(FinishWalkError::IdempotencyConflict(IdempotencyConflictError)),
        );
        let result = finish_walk(
            deps(&walks, &confirmed, &queue, &clock, &sleep, 30_000),
            "sub",
            "walk-1",
            "idem-1",
        )
        .await;
        assert!(matches!(result, FinishWalkResult::IdempotencyConflict));
    }
}
