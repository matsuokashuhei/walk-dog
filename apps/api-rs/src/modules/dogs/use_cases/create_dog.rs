//! Create dog with a daily 30-minute goal revision.

use crate::modules::dogs::errors::DogNameDuplicateError;
use crate::modules::dogs::repository::DogRepository;
use crate::modules::dogs::types::{Birthday, CreateDogInput, Dog, Gender};
use crate::modules::owners::repository::OwnerRepository;

pub enum CreateDogResult {
    Created(Box<Dog>),
    DuplicateName,
}

pub async fn create_dog(
    owners: &dyn OwnerRepository,
    dogs: &dyn DogRepository,
    cognito_subject: &str,
    name: &str,
    gender: Gender,
    birthday: Birthday,
) -> CreateDogResult {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    match dogs
        .create_with_daily_goal(
            &owner.owner_id,
            &CreateDogInput {
                name: name.to_string(),
                gender,
                birthday,
            },
        )
        .await
    {
        Ok(dog) => CreateDogResult::Created(Box::new(dog)),
        Err(DogNameDuplicateError) => CreateDogResult::DuplicateName,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::dogs::types::{CurrentGoal, GoalPeriodLiteral};
    use crate::modules::owners::types::Owner;
    use std::sync::Mutex;

    fn sample_dog(owner_id: &str, name: &str) -> Dog {
        Dog {
            dog_id: "d1".into(),
            owner_id: owner_id.into(),
            name: name.into(),
            gender: Gender::Female,
            birthday: Birthday::Unknown,
            avatar_url: None,
            created_at: jiff::Timestamp::from_second(1).unwrap(),
            updated_at: jiff::Timestamp::from_second(1).unwrap(),
            current_goal: CurrentGoal {
                goal_revision_id: "g1".into(),
                period: GoalPeriodLiteral::Daily,
                minutes: 30,
                effective_from: jiff::Timestamp::from_second(1).unwrap(),
                effective_to: None,
            },
        }
    }

    struct FakeOwners;
    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, _: &str) -> Owner {
            Owner {
                owner_id: "owner-1".into(),
                display_name: None,
                avatar_url: None,
                created_at: jiff::Timestamp::from_second(1).unwrap(),
                updated_at: jiff::Timestamp::from_second(1).unwrap(),
            }
        }
        async fn update_display_name(&self, _: &str, _: &str) -> Owner {
            unreachable!()
        }
    }

    struct FakeDogs {
        duplicate: bool,
        calls: Mutex<Vec<(String, CreateDogInput)>>,
    }

    #[async_trait::async_trait]
    impl DogRepository for FakeDogs {
        async fn list_by_owner(&self, _: &str) -> Vec<Dog> {
            unreachable!()
        }
        async fn create_with_daily_goal(
            &self,
            owner_id: &str,
            input: &CreateDogInput,
        ) -> Result<Dog, DogNameDuplicateError> {
            self.calls
                .lock()
                .unwrap()
                .push((owner_id.to_string(), input.clone()));
            if self.duplicate {
                Err(DogNameDuplicateError)
            } else {
                Ok(sample_dog(owner_id, &input.name))
            }
        }
        async fn get_by_owner_and_id(&self, _: &str, _: &str) -> Option<Dog> {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn creates_dog_for_resolved_owner() {
        let dogs = FakeDogs {
            duplicate: false,
            calls: Mutex::new(vec![]),
        };
        let result = create_dog(
            &FakeOwners,
            &dogs,
            "sub",
            "Mugi",
            Gender::Female,
            Birthday::Day {
                year: 2020,
                month: 4,
                day: 12,
            },
        )
        .await;
        match result {
            CreateDogResult::Created(dog) => {
                assert_eq!(dog.name, "Mugi");
                assert_eq!(dog.owner_id, "owner-1");
                assert_eq!(dog.current_goal.minutes, 30);
            }
            CreateDogResult::DuplicateName => panic!("expected created"),
        }
        let calls = dogs.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, "owner-1");
        assert_eq!(calls[0].1.name, "Mugi");
    }

    #[tokio::test]
    async fn returns_duplicate_name() {
        let dogs = FakeDogs {
            duplicate: true,
            calls: Mutex::new(vec![]),
        };
        let result = create_dog(
            &FakeOwners,
            &dogs,
            "sub",
            "Mugi",
            Gender::Female,
            Birthday::Unknown,
        )
        .await;
        assert!(matches!(result, CreateDogResult::DuplicateName));
    }
}
