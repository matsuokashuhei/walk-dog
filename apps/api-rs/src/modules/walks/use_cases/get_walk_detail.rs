//! Load completed walk detail with Dynamo track points and Postgres events.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::errors::WalkNotFoundError;
use crate::modules::walks::provider::ConfirmedTrackPoints;
use crate::modules::walks::repository::WalkRepository;
use crate::modules::walks::types::WalkDetail;

pub enum GetWalkDetailResult {
    Found(WalkDetail),
    NotFound,
}

pub async fn get_walk_detail(
    owners: &dyn OwnerRepository,
    walks: &dyn WalkRepository,
    confirmed: &dyn ConfirmedTrackPoints,
    cognito_subject: &str,
    walk_id: &str,
) -> GetWalkDetailResult {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    let walk = match walks
        .get_completed_by_owner(&owner.owner_id, walk_id)
        .await
    {
        Ok(walk) => walk,
        Err(WalkNotFoundError) => return GetWalkDetailResult::NotFound,
    };
    let track_points = confirmed
        .list_points(walk_id)
        .await
        .expect("confirmed track points list");
    let events = walks.list_events(walk_id).await;
    GetWalkDetailResult::Found(WalkDetail {
        walk,
        track_points,
        events,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::repository::{
        AcceptTrackPointError, FailWalkError, FinishWalkError, ListAcceptedError, StartWalkError,
    };
    use crate::modules::walks::types::{
        AcceptTrackPointInput, CompletedWalk, ConfirmedTrackPoint, FinishWalkInput, RecordingWalk,
        StartWalkInput, TrackPoint, WalkEvent, WalkEventType, WalkParticipant,
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
            started_at: jiff::Timestamp::from_second(1_700_000_000).unwrap(),
            completed_at: jiff::Timestamp::from_second(1_700_000_600).unwrap(),
            duration_seconds: 600,
            distance_meters: 120,
            pace_seconds_per_meter: Some(5.0),
            participants: vec![WalkParticipant {
                walk_participant_id: "wp-1".into(),
                dog_id: "dog-1".into(),
                name: "Mugi".into(),
            }],
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
        completed: Mutex<Result<CompletedWalk, WalkNotFoundError>>,
        events: Mutex<Vec<WalkEvent>>,
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
            self.completed.lock().unwrap().clone()
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
            _: &AcceptTrackPointInput,
        ) -> Result<TrackPoint, AcceptTrackPointError> {
            unreachable!()
        }
        async fn list_accepted_recorded_at(
            &self,
            _: &str,
            _: &str,
        ) -> Result<Vec<jiff::Timestamp>, ListAcceptedError> {
            unreachable!()
        }
        async fn list_events(&self, _: &str) -> Vec<WalkEvent> {
            self.events.lock().unwrap().clone()
        }
    }

    struct FakeConfirmed {
        points: Mutex<Vec<ConfirmedTrackPoint>>,
    }

    #[async_trait::async_trait]
    impl ConfirmedTrackPoints for FakeConfirmed {
        async fn list_points(&self, _: &str) -> Result<Vec<ConfirmedTrackPoint>, ()> {
            Ok(self.points.lock().unwrap().clone())
        }
        async fn list_recorded_at(&self, _: &str) -> Result<Vec<jiff::Timestamp>, ()> {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn returns_detail_with_points_and_events() {
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let walks = FakeWalks {
            completed: Mutex::new(Ok(sample_completed())),
            events: Mutex::new(vec![WalkEvent {
                event_id: "ev-1".into(),
                walk_id: "walk-1".into(),
                participant_dog_id: "dog-1".into(),
                event_type: WalkEventType::Pee,
                occurred_at: recorded_at,
                latitude: 35.0,
                longitude: 139.0,
            }]),
        };
        let confirmed = FakeConfirmed {
            points: Mutex::new(vec![ConfirmedTrackPoint {
                recorded_at,
                latitude: 35.0,
                longitude: 139.0,
            }]),
        };
        let result = get_walk_detail(&FakeOwners, &walks, &confirmed, "sub", "walk-1").await;
        match result {
            GetWalkDetailResult::Found(detail) => {
                assert_eq!(detail.walk.walk_id, "walk-1");
                assert_eq!(detail.track_points.len(), 1);
                assert_eq!(detail.events.len(), 1);
            }
            GetWalkDetailResult::NotFound => panic!("expected found"),
        }
    }

    #[tokio::test]
    async fn maps_not_found() {
        let walks = FakeWalks {
            completed: Mutex::new(Err(WalkNotFoundError)),
            events: Mutex::new(vec![]),
        };
        let confirmed = FakeConfirmed {
            points: Mutex::new(vec![]),
        };
        let result = get_walk_detail(&FakeOwners, &walks, &confirmed, "sub", "walk-1").await;
        assert!(matches!(result, GetWalkDetailResult::NotFound));
    }
}
