//! Owner repository trait — mirrors TypeScript `modules/owners/repository.ts`.

use crate::modules::owners::types::Owner;

#[async_trait::async_trait]
pub trait OwnerRepository: Send + Sync {
    async fn resolve_by_cognito_subject(&self, cognito_subject: &str) -> Owner;
    async fn update_display_name(&self, cognito_subject: &str, display_name: &str) -> Owner;
}
