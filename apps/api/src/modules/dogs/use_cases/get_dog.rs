//! Get a single dog owned by the authenticated owner.

use crate::modules::dogs::repository::DogRepository;
use crate::modules::dogs::types::Dog;
use crate::modules::owners::repository::OwnerRepository;

pub enum GetDogResult {
    Found(Box<Dog>),
    NotFound,
}

pub async fn get_dog(
    owners: &dyn OwnerRepository,
    dogs: &dyn DogRepository,
    cognito_subject: &str,
    dog_id: &str,
) -> GetDogResult {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    match dogs.get_by_owner_and_id(&owner.owner_id, dog_id).await {
        Some(dog) => GetDogResult::Found(Box::new(dog)),
        None => GetDogResult::NotFound,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::dogs::errors::DogNameDuplicateError;
    use crate::modules::dogs::types::{
        Birthday, CreateDogInput, CurrentGoal, Gender, GoalPeriodLiteral,
    };
    use crate::modules::owners::types::Owner;

    fn sample_dog() -> Dog {
        Dog {
            dog_id: "d1".into(),
            owner_id: "owner-1".into(),
            name: "Mugi".into(),
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
        found: bool,
    }

    #[async_trait::async_trait]
    impl DogRepository for FakeDogs {
        async fn list_by_owner(&self, _: &str) -> Vec<Dog> {
            unreachable!()
        }
        async fn create_with_daily_goal(
            &self,
            _: &str,
            _: &CreateDogInput,
        ) -> Result<Dog, DogNameDuplicateError> {
            unreachable!()
        }
        async fn get_by_owner_and_id(&self, owner_id: &str, dog_id: &str) -> Option<Dog> {
            if self.found && owner_id == "owner-1" && dog_id == "d1" {
                Some(sample_dog())
            } else {
                None
            }
        }
    }

    #[tokio::test]
    async fn returns_found_dog() {
        let result = get_dog(&FakeOwners, &FakeDogs { found: true }, "sub", "d1").await;
        assert!(matches!(result, GetDogResult::Found(_)));
    }

    #[tokio::test]
    async fn returns_not_found() {
        let result = get_dog(&FakeOwners, &FakeDogs { found: false }, "sub", "d1").await;
        assert!(matches!(result, GetDogResult::NotFound));
    }
}
