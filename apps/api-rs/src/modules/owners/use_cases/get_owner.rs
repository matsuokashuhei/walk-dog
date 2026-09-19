//! Get owner use case.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::owners::types::Owner;

pub async fn get_owner(owners: &dyn OwnerRepository, cognito_subject: &str) -> Owner {
    owners.resolve_by_cognito_subject(cognito_subject).await
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeOwners;

    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, cognito_subject: &str) -> Owner {
            Owner {
                owner_id: format!("id-{cognito_subject}"),
                display_name: Some("A".into()),
                avatar_url: None,
                created_at: jiff::Timestamp::from_second(1).unwrap(),
                updated_at: jiff::Timestamp::from_second(2).unwrap(),
            }
        }
        async fn update_display_name(&self, _: &str, _: &str) -> Owner {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn resolves_owner() {
        let owner = get_owner(&FakeOwners, "sub").await;
        assert_eq!(owner.owner_id, "id-sub");
        assert_eq!(owner.avatar_url, None);
    }
}
