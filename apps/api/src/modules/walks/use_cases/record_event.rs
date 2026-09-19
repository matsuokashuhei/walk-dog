//! Record a walk event on a recording walk.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::repository::{RecordEventError, WalkRepository};
use crate::modules::walks::types::{RecordEventInput, RecordedEvent, WalkEventType};

pub struct RecordEventDeps<'a> {
    pub owners: &'a dyn OwnerRepository,
    pub walks: &'a dyn WalkRepository,
}

pub struct RecordEventCommand {
    pub walk_id: String,
    pub event_id: String,
    pub participant_dog_id: String,
    pub event_type: WalkEventType,
    pub occurred_at: jiff::Timestamp,
    pub latitude: f64,
    pub longitude: f64,
}

pub enum RecordEventResult {
    Recorded(RecordedEvent),
    NotFound,
    NotRecording,
    IdempotencyConflict,
}

pub async fn record_event(
    deps: RecordEventDeps<'_>,
    cognito_subject: &str,
    command: RecordEventCommand,
) -> RecordEventResult {
    let owner = deps.owners.resolve_by_cognito_subject(cognito_subject).await;
    match deps
        .walks
        .record_event(&RecordEventInput {
            owner_id: owner.owner_id,
            walk_id: command.walk_id,
            event_id: command.event_id,
            participant_dog_id: command.participant_dog_id,
            event_type: command.event_type,
            occurred_at: command.occurred_at,
            latitude: command.latitude,
            longitude: command.longitude,
        })
        .await
    {
        Ok(recorded) => RecordEventResult::Recorded(recorded),
        Err(RecordEventError::NotFound(_)) => RecordEventResult::NotFound,
        Err(RecordEventError::NotRecording(_)) => RecordEventResult::NotRecording,
        Err(RecordEventError::IdempotencyConflict(_)) => RecordEventResult::IdempotencyConflict,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::errors::{
        IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
    };
    use crate::modules::walks::repository::{
        AcceptTrackPointError, FailWalkError, FinishWalkError, ListAcceptedError, StartWalkError,
    };
    use crate::modules::walks::types::{
        AcceptTrackPointInput, CompletedWalk, FinishWalkInput, RecordingWalk, StartWalkInput,
        TrackPoint, WalkEvent,
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

    fn sample_event() -> WalkEvent {
        WalkEvent {
            event_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90".into(),
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            participant_dog_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70".into(),
            event_type: WalkEventType::Pee,
            occurred_at: "2026-09-06T03:20:11Z".parse().unwrap(),
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
        result: Mutex<Result<RecordedEvent, RecordEventError>>,
        calls: Mutex<Vec<RecordEventInput>>,
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
            _: &AcceptTrackPointInput,
        ) -> Result<TrackPoint, AcceptTrackPointError> {
            unreachable!()
        }
        async fn record_event(
            &self,
            input: &RecordEventInput,
        ) -> Result<RecordedEvent, RecordEventError> {
            self.calls.lock().unwrap().push(input.clone());
            self.result.lock().unwrap().clone()
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

    fn deps(walks: &FakeWalks) -> RecordEventDeps<'_> {
        RecordEventDeps {
            owners: &FakeOwners,
            walks,
        }
    }

    fn command_from(event: &WalkEvent) -> RecordEventCommand {
        RecordEventCommand {
            walk_id: event.walk_id.clone(),
            event_id: event.event_id.clone(),
            participant_dog_id: event.participant_dog_id.clone(),
            event_type: event.event_type,
            occurred_at: event.occurred_at,
            latitude: event.latitude,
            longitude: event.longitude,
        }
    }

    #[tokio::test]
    async fn records_created_true() {
        let event = sample_event();
        let walks = FakeWalks {
            result: Mutex::new(Ok(RecordedEvent {
                event: event.clone(),
                created: true,
            })),
            calls: Mutex::new(vec![]),
        };
        let result = record_event(deps(&walks), "sub", command_from(&event)).await;
        assert!(matches!(
            result,
            RecordEventResult::Recorded(RecordedEvent { created: true, .. })
        ));
        assert_eq!(walks.calls.lock().unwrap()[0].owner_id, "owner-1");
        assert_eq!(
            walks.calls.lock().unwrap()[0].event_type,
            WalkEventType::Pee
        );
    }

    #[tokio::test]
    async fn records_created_false_on_replay() {
        let event = sample_event();
        let walks = FakeWalks {
            result: Mutex::new(Ok(RecordedEvent {
                event: event.clone(),
                created: false,
            })),
            calls: Mutex::new(vec![]),
        };
        let result = record_event(deps(&walks), "sub", command_from(&event)).await;
        assert!(matches!(
            result,
            RecordEventResult::Recorded(RecordedEvent { created: false, .. })
        ));
    }

    #[tokio::test]
    async fn maps_not_found() {
        let event = sample_event();
        let walks = FakeWalks {
            result: Mutex::new(Err(RecordEventError::NotFound(WalkNotFoundError))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            record_event(deps(&walks), "sub", command_from(&event)).await,
            RecordEventResult::NotFound
        ));
    }

    #[tokio::test]
    async fn maps_not_recording() {
        let event = sample_event();
        let walks = FakeWalks {
            result: Mutex::new(Err(RecordEventError::NotRecording(WalkNotRecordingError))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            record_event(deps(&walks), "sub", command_from(&event)).await,
            RecordEventResult::NotRecording
        ));
    }

    #[tokio::test]
    async fn maps_idempotency_conflict() {
        let event = sample_event();
        let walks = FakeWalks {
            result: Mutex::new(Err(RecordEventError::IdempotencyConflict(
                IdempotencyConflictError,
            ))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            record_event(deps(&walks), "sub", command_from(&event)).await,
            RecordEventResult::IdempotencyConflict
        ));
    }
}
