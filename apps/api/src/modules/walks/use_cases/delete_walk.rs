//! Delete (fail) a recording walk.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::repository::{FailWalkError, WalkRepository};

pub enum DeleteWalkResult {
    Deleted,
    NotFound,
    NotRecording,
}

pub async fn delete_walk(
    owners: &dyn OwnerRepository,
    walks: &dyn WalkRepository,
    cognito_subject: &str,
    walk_id: &str,
) -> DeleteWalkResult {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    match walks.fail(&owner.owner_id, walk_id).await {
        Ok(()) => DeleteWalkResult::Deleted,
        Err(FailWalkError::NotFound(_)) => DeleteWalkResult::NotFound,
        Err(FailWalkError::NotRecording(_)) => DeleteWalkResult::NotRecording,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::errors::{WalkNotFoundError, WalkNotRecordingError};
    use crate::modules::walks::repository::StartWalkError;
    use crate::modules::walks::types::{RecordingWalk, StartWalkInput};
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
        result: Mutex<Result<(), FailWalkError>>,
        calls: Mutex<Vec<(String, String)>>,
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
        ) -> Result<crate::modules::walks::types::CompletedWalk, crate::modules::walks::errors::WalkNotFoundError> {
            unreachable!()
        }
        async fn finish(
            &self,
            _: &crate::modules::walks::types::FinishWalkInput,
        ) -> Result<crate::modules::walks::types::CompletedWalk, crate::modules::walks::repository::FinishWalkError> {
            unreachable!()
        }
        async fn accept_track_point(
            &self,
            _: &crate::modules::walks::types::AcceptTrackPointInput,
        ) -> Result<crate::modules::walks::types::TrackPoint, crate::modules::walks::repository::AcceptTrackPointError> {
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
            _: &str,
            _: &str,
        ) -> Result<Vec<jiff::Timestamp>, crate::modules::walks::repository::ListAcceptedError> {
            unreachable!()
        }
        async fn list_events(&self, _: &str) -> Vec<crate::modules::walks::types::WalkEvent> {
            unreachable!()
        }

        async fn start(&self, _: &StartWalkInput) -> Result<RecordingWalk, StartWalkError> {
            unreachable!()
        }
        async fn fail(&self, owner_id: &str, walk_id: &str) -> Result<(), FailWalkError> {
            self.calls
                .lock()
                .unwrap()
                .push((owner_id.to_string(), walk_id.to_string()));
            self.result.lock().unwrap().clone()
        }
        async fn fail_if_present(&self, _: &str) {}
    }

    #[tokio::test]
    async fn fails_walk_for_owner() {
        let walks = FakeWalks {
            result: Mutex::new(Ok(())),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            delete_walk(&FakeOwners, &walks, "sub", "walk-1").await,
            DeleteWalkResult::Deleted
        ));
        assert_eq!(
            walks.calls.lock().unwrap().as_slice(),
            [("owner-1".into(), "walk-1".into())]
        );
    }

    #[tokio::test]
    async fn maps_not_found() {
        let walks = FakeWalks {
            result: Mutex::new(Err(FailWalkError::NotFound(WalkNotFoundError))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            delete_walk(&FakeOwners, &walks, "sub", "walk-1").await,
            DeleteWalkResult::NotFound
        ));
    }

    #[tokio::test]
    async fn maps_not_recording() {
        let walks = FakeWalks {
            result: Mutex::new(Err(FailWalkError::NotRecording(WalkNotRecordingError))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            delete_walk(&FakeOwners, &walks, "sub", "walk-1").await,
            DeleteWalkResult::NotRecording
        ));
    }
}
