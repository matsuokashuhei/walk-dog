//! List dogs for the authenticated owner.

use crate::modules::dogs::repository::DogRepository;
use crate::modules::dogs::types::Dog;
use crate::modules::owners::repository::OwnerRepository;

pub async fn list_dogs(
    owners: &dyn OwnerRepository,
    dogs: &dyn DogRepository,
    cognito_subject: &str,
) -> Vec<Dog> {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    dogs.list_by_owner(&owner.owner_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::dogs::errors::DogNameDuplicateError;
    use crate::modules::dogs::types::{
        Birthday, CreateDogInput, CurrentGoal, Gender, GoalPeriodLiteral,
    };
    use crate::modules::owners::types::Owner;
    use std::sync::Mutex;

    fn sample_dog(owner_id: &str) -> Dog {
        Dog {
            dog_id: "d1".into(),
            owner_id: owner_id.into(),
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
        async fn resolve_by_cognito_subject(&self, cognito_subject: &str) -> Owner {
            Owner {
                owner_id: format!("owner-{cognito_subject}"),
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
        listed_for: Mutex<Vec<String>>,
    }

    #[async_trait::async_trait]
    impl DogRepository for FakeDogs {
        async fn list_by_owner(&self, owner_id: &str) -> Vec<Dog> {
            self.listed_for.lock().unwrap().push(owner_id.to_string());
            vec![sample_dog(owner_id)]
        }
        async fn create_with_daily_goal(
            &self,
            _: &str,
            _: &CreateDogInput,
        ) -> Result<Dog, DogNameDuplicateError> {
            unreachable!()
        }
        async fn get_by_owner_and_id(&self, _: &str, _: &str) -> Option<Dog> {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn lists_dogs_for_resolved_owner() {
        let dogs = FakeDogs {
            listed_for: Mutex::new(vec![]),
        };
        let result = list_dogs(&FakeOwners, &dogs, "sub-1").await;
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].owner_id, "owner-sub-1");
        assert_eq!(*dogs.listed_for.lock().unwrap(), vec!["owner-sub-1"]);
    }
}
