//! Get active recording walk for the authenticated owner.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::repository::WalkRepository;
use crate::modules::walks::types::RecordingWalk;

pub async fn get_active_walk(
    owners: &dyn OwnerRepository,
    walks: &dyn WalkRepository,
    cognito_subject: &str,
) -> Option<RecordingWalk> {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    walks.get_active_by_owner(&owner.owner_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::repository::{FailWalkError, StartWalkError};
    use crate::modules::walks::types::{StartWalkInput, WalkParticipant};
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

    fn sample_walk() -> RecordingWalk {
        RecordingWalk {
            walk_id: "walk-1".into(),
            owner_id: "owner-1".into(),
            started_at: jiff::Timestamp::from_second(1_700_000_000).unwrap(),
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
        active: Mutex<Option<RecordingWalk>>,
        calls: Mutex<Vec<String>>,
    }

    #[async_trait::async_trait]
    impl WalkRepository for FakeWalks {
        async fn get_active_by_owner(&self, owner_id: &str) -> Option<RecordingWalk> {
            self.calls.lock().unwrap().push(owner_id.to_string());
            self.active.lock().unwrap().clone()
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
        async fn fail(&self, _: &str, _: &str) -> Result<(), FailWalkError> {
            unreachable!()
        }
        async fn fail_if_present(&self, _: &str) {}
    }

    #[tokio::test]
    async fn returns_recording_walk() {
        let walks = FakeWalks {
            active: Mutex::new(Some(sample_walk())),
            calls: Mutex::new(vec![]),
        };
        let result = get_active_walk(&FakeOwners, &walks, "sub").await;
        assert_eq!(result, Some(sample_walk()));
        assert_eq!(walks.calls.lock().unwrap().as_slice(), ["owner-1"]);
    }

    #[tokio::test]
    async fn returns_none_when_no_active_walk() {
        let walks = FakeWalks {
            active: Mutex::new(None),
            calls: Mutex::new(vec![]),
        };
        assert!(get_active_walk(&FakeOwners, &walks, "sub").await.is_none());
    }
}
