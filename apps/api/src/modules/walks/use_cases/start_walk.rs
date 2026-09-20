//! Start a recording walk with Idempotency-Key body hashing.

use sha2::{Digest, Sha256};

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::repository::{StartWalkError, WalkRepository};
use crate::modules::walks::types::{RecordingWalk, StartWalkInput};

pub enum StartWalkResult {
    Started(Box<RecordingWalk>),
    NotFound,
    ActiveWalkExists,
    IdempotencyConflict,
}

pub async fn start_walk(
    owners: &dyn OwnerRepository,
    walks: &dyn WalkRepository,
    cognito_subject: &str,
    participant_dog_ids: Vec<String>,
    idempotency_key: &str,
) -> StartWalkResult {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    let body_hash = hash_start_body(&participant_dog_ids);
    match walks
        .start(&StartWalkInput {
            owner_id: owner.owner_id,
            participant_dog_ids,
            idempotency_key: idempotency_key.to_string(),
            body_hash,
        })
        .await
    {
        Ok(walk) => StartWalkResult::Started(Box::new(walk)),
        Err(StartWalkError::ActiveWalkExists(_)) => StartWalkResult::ActiveWalkExists,
        Err(StartWalkError::NotFound(_)) => StartWalkResult::NotFound,
        Err(StartWalkError::IdempotencyConflict(_)) => StartWalkResult::IdempotencyConflict,
    }
}

fn hash_start_body(participant_dog_ids: &[String]) -> String {
    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Body<'a> {
        participant_dog_ids: &'a [String],
    }
    let json = serde_json::to_string(&Body {
        participant_dog_ids,
    })
    .expect("start walk body hash json");
    let digest = Sha256::digest(json.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::errors::{
        ActiveWalkExistsError, IdempotencyConflictError, WalkNotFoundError,
    };
    use crate::modules::walks::repository::FailWalkError;
    use crate::modules::walks::types::WalkParticipant;
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
        result: Mutex<Result<RecordingWalk, StartWalkError>>,
        calls: Mutex<Vec<StartWalkInput>>,
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
        async fn list_accepted_track_points(
            &self,
            _: &str,
            _: &str,
        ) -> Result<Vec<crate::modules::walks::types::TrackPoint>, crate::modules::walks::repository::ListAcceptedError> {
            unreachable!()
        }

        async fn list_events(&self, _: &str) -> Vec<crate::modules::walks::types::WalkEvent> {
            unreachable!()
        }

        async fn start(&self, input: &StartWalkInput) -> Result<RecordingWalk, StartWalkError> {
            self.calls.lock().unwrap().push(input.clone());
            self.result.lock().unwrap().clone()
        }
        async fn fail(&self, _: &str, _: &str) -> Result<(), FailWalkError> {
            unreachable!()
        }
        async fn fail_if_present(&self, _: &str) {}
    }

    #[tokio::test]
    async fn hashes_body_and_starts_walk() {
        let dog_ids = vec![
            "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70".into(),
            "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e72".into(),
        ];
        let expected_hash = hash_start_body(&dog_ids);
        let walks = FakeWalks {
            result: Mutex::new(Ok(sample_walk())),
            calls: Mutex::new(vec![]),
        };
        let result = start_walk(
            &FakeOwners,
            &walks,
            "sub",
            dog_ids.clone(),
            "idem-1",
        )
        .await;
        assert!(matches!(result, StartWalkResult::Started(_)));
        let calls = walks.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].owner_id, "owner-1");
        assert_eq!(calls[0].participant_dog_ids, dog_ids);
        assert_eq!(calls[0].idempotency_key, "idem-1");
        assert_eq!(calls[0].body_hash, expected_hash);
    }

    #[tokio::test]
    async fn maps_active_walk_exists() {
        let walks = FakeWalks {
            result: Mutex::new(Err(StartWalkError::ActiveWalkExists(ActiveWalkExistsError))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            start_walk(&FakeOwners, &walks, "sub", vec!["d1".into()], "k").await,
            StartWalkResult::ActiveWalkExists
        ));
    }

    #[tokio::test]
    async fn maps_not_found() {
        let walks = FakeWalks {
            result: Mutex::new(Err(StartWalkError::NotFound(WalkNotFoundError))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            start_walk(&FakeOwners, &walks, "sub", vec!["d1".into()], "k").await,
            StartWalkResult::NotFound
        ));
    }

    #[tokio::test]
    async fn maps_idempotency_conflict() {
        let walks = FakeWalks {
            result: Mutex::new(Err(StartWalkError::IdempotencyConflict(
                IdempotencyConflictError,
            ))),
            calls: Mutex::new(vec![]),
        };
        assert!(matches!(
            start_walk(&FakeOwners, &walks, "sub", vec!["d1".into()], "k").await,
            StartWalkResult::IdempotencyConflict
        ));
    }
}
