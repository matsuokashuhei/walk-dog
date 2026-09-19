//! Update owner display name use case.

use crate::modules::owners::repository::OwnerRepository;
use crate::modules::owners::types::Owner;

pub async fn update_owner_display_name(
    owners: &dyn OwnerRepository,
    cognito_subject: &str,
    display_name: &str,
) -> Owner {
    owners
        .update_display_name(cognito_subject, display_name)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeOwners;

    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, _: &str) -> Owner {
            unreachable!()
        }
        async fn update_display_name(&self, cognito_subject: &str, display_name: &str) -> Owner {
            Owner {
                owner_id: format!("id-{cognito_subject}"),
                display_name: Some(display_name.to_string()),
                avatar_url: None,
                created_at: jiff::Timestamp::from_second(1).unwrap(),
                updated_at: jiff::Timestamp::from_second(3).unwrap(),
            }
        }
    }

    #[tokio::test]
    async fn updates_display_name() {
        let owner = update_owner_display_name(&FakeOwners, "sub", "Nova").await;
        assert_eq!(owner.display_name.as_deref(), Some("Nova"));
    }
}
