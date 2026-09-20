//! Finish a recording walk after accepted points are confirmed in Dynamo.

use sha2::{Digest, Sha256};

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::path_distance::path_distance_meters;
use crate::modules::walks::provider::{ConfirmTrackPoint, ConfirmedTrackPoints};
use crate::modules::walks::repository::{FinishWalkError, ListAcceptedError, WalkRepository};
use crate::modules::walks::types::{CompletedWalk, FinishWalkInput, TrackPoint};

/// Max concurrent Dynamo PutItem calls while repairing missing confirmations.
const CONFIRM_CONCURRENCY: usize = 32;

pub struct FinishWalkDeps<'a> {
    pub owners: &'a dyn OwnerRepository,
    pub walks: &'a dyn WalkRepository,
    pub confirmed: &'a dyn ConfirmedTrackPoints,
    pub confirm: &'a dyn ConfirmTrackPoint,
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

    if !accepted.is_empty()
        && confirm_missing(deps.confirmed, deps.confirm, walk_id, &accepted)
            .await
            .is_err()
    {
        return FinishWalkResult::ServiceUnavailable;
    }

    let distance_meters = path_distance_meters(
        &accepted
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

/// Writes any accepted Postgres points that are missing from Dynamo directly,
/// so Finish does not wait on the SQS worker for orphaned confirmations.
async fn confirm_missing(
    confirmed: &dyn ConfirmedTrackPoints,
    confirm: &dyn ConfirmTrackPoint,
    walk_id: &str,
    accepted: &[TrackPoint],
) -> Result<(), ()> {
    let confirmed_at = confirmed.list_recorded_at(walk_id).await?;
    let have: std::collections::HashSet<_> = confirmed_at.iter().copied().collect();
    let missing: Vec<&TrackPoint> = accepted
        .iter()
        .filter(|point| !have.contains(&point.recorded_at))
        .collect();

    for chunk in missing.chunks(CONFIRM_CONCURRENCY) {
        futures::future::try_join_all(chunk.iter().map(|point| confirm.confirm(point))).await?;
    }
    Ok(())
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

    /// One store that both lists and reflects confirms — production Dynamo behavior.
    struct FakeDynamo {
        points: Mutex<Vec<TrackPoint>>,
        list_fail: Mutex<bool>,
        confirm_fail: Mutex<bool>,
    }

    impl FakeDynamo {
        fn empty() -> Self {
            Self {
                points: Mutex::new(vec![]),
                list_fail: Mutex::new(false),
                confirm_fail: Mutex::new(false),
            }
        }

        fn with_points(points: Vec<TrackPoint>) -> Self {
            Self {
                points: Mutex::new(points),
                list_fail: Mutex::new(false),
                confirm_fail: Mutex::new(false),
            }
        }
    }

    #[async_trait::async_trait]
    impl ConfirmedTrackPoints for FakeDynamo {
        async fn list_points(&self, _: &str) -> Result<Vec<ConfirmedTrackPoint>, ()> {
            if *self.list_fail.lock().unwrap() {
                return Err(());
            }
            Ok(self
                .points
                .lock()
                .unwrap()
                .iter()
                .map(|point| ConfirmedTrackPoint {
                    recorded_at: point.recorded_at,
                    latitude: point.latitude,
                    longitude: point.longitude,
                })
                .collect())
        }
        async fn list_recorded_at(&self, walk_id: &str) -> Result<Vec<jiff::Timestamp>, ()> {
            Ok(self
                .list_points(walk_id)
                .await?
                .into_iter()
                .map(|point| point.recorded_at)
                .collect())
        }
    }

    #[async_trait::async_trait]
    impl ConfirmTrackPoint for FakeDynamo {
        async fn confirm(&self, track_point: &TrackPoint) -> Result<(), ()> {
            if *self.confirm_fail.lock().unwrap() {
                return Err(());
            }
            let mut points = self.points.lock().unwrap();
            if !points
                .iter()
                .any(|point| point.recorded_at == track_point.recorded_at)
            {
                points.push(track_point.clone());
            }
            Ok(())
        }
    }

    fn sut(
        accepted: Result<Vec<TrackPoint>, ListAcceptedError>,
        finish: Result<CompletedWalk, FinishWalkError>,
    ) -> (FakeWalks, FakeDynamo) {
        (
            FakeWalks {
                accepted: Mutex::new(accepted),
                finish_result: Mutex::new(finish),
                finish_calls: Mutex::new(vec![]),
            },
            FakeDynamo::empty(),
        )
    }

    fn deps<'a>(walks: &'a FakeWalks, dynamo: &'a FakeDynamo) -> FinishWalkDeps<'a> {
        FinishWalkDeps {
            owners: &FakeOwners,
            walks,
            confirmed: dynamo,
            confirm: dynamo,
        }
    }

    #[tokio::test]
    async fn finishes_immediately_without_accepted_points() {
        let (walks, dynamo) = sut(Ok(vec![]), Ok(sample_completed()));
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        let calls = walks.finish_calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].distance_meters, 0);
        assert_eq!(calls[0].body_hash, empty_body_hash());
        assert!(dynamo.points.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn treats_not_recording_accepted_list_as_empty_then_finishes() {
        let (walks, dynamo) = sut(
            Err(ListAcceptedError::NotRecording(WalkNotRecordingError)),
            Ok(sample_completed()),
        );
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
    }

    #[tokio::test]
    async fn maps_not_found_from_accepted_list() {
        let (walks, dynamo) = sut(
            Err(ListAcceptedError::NotFound(WalkNotFoundError)),
            Ok(sample_completed()),
        );
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::NotFound));
    }

    #[tokio::test]
    async fn finishes_when_points_already_confirmed_without_extra_puts() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let point = sample_point(recorded_at);
        let (walks, _) = sut(Ok(vec![point.clone()]), Ok(sample_completed()));
        let dynamo = FakeDynamo::with_points(vec![point]);
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        assert_eq!(walks.finish_calls.lock().unwrap()[0].distance_meters, 0);
        assert_eq!(dynamo.points.lock().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn confirms_missing_accepted_points_then_finishes_using_accepted_distance() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00.123Z".parse().unwrap();
        let point = sample_point(recorded_at);
        let (walks, dynamo) = sut(Ok(vec![point.clone()]), Ok(sample_completed()));
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        assert_eq!(dynamo.points.lock().unwrap().as_slice(), &[point]);
        assert_eq!(walks.finish_calls.lock().unwrap()[0].distance_meters, 0);
    }

    #[tokio::test]
    async fn confirms_many_missing_points_and_computes_distance_from_accepted() {
        let points: Vec<TrackPoint> = (0..250)
            .map(|i| {
                let recorded_at =
                    jiff::Timestamp::from_millisecond(1_723_636_800_000 + i * 10_000).unwrap();
                TrackPoint {
                    track_point_id: format!("tp-{i}"),
                    walk_id: "walk-1".into(),
                    recorded_at,
                    latitude: 35.0 + (i as f64) * 0.0001,
                    longitude: 139.0 + (i as f64) * 0.0001,
                }
            })
            .collect();
        let expected_distance = path_distance_meters(
            &points
                .iter()
                .map(|point| (point.latitude, point.longitude))
                .collect::<Vec<_>>(),
        );
        let (walks, dynamo) = sut(Ok(points.clone()), Ok(sample_completed()));
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::Finished(_)));
        assert_eq!(dynamo.points.lock().unwrap().len(), 250);
        assert_eq!(
            walks.finish_calls.lock().unwrap()[0].distance_meters,
            expected_distance
        );
        assert!(expected_distance > 0);
    }

    #[tokio::test]
    async fn maps_confirm_failure_during_repair_to_service_unavailable() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let (walks, dynamo) = sut(Ok(vec![sample_point(recorded_at)]), Ok(sample_completed()));
        *dynamo.confirm_fail.lock().unwrap() = true;
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::ServiceUnavailable));
        assert!(walks.finish_calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn maps_list_confirmed_failure_to_service_unavailable() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let (walks, dynamo) = sut(Ok(vec![sample_point(recorded_at)]), Ok(sample_completed()));
        *dynamo.list_fail.lock().unwrap() = true;
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::ServiceUnavailable));
        assert!(walks.finish_calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn maps_finish_errors() {
        let (walks, dynamo) = sut(
            Ok(vec![]),
            Err(FinishWalkError::IdempotencyConflict(IdempotencyConflictError)),
        );
        let result = finish_walk(deps(&walks, &dynamo), "sub", "walk-1", "idem-1").await;
        assert!(matches!(result, FinishWalkResult::IdempotencyConflict));
    }
}
