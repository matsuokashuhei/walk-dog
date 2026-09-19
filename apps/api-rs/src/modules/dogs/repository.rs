//! Dog repository trait — mirrors TypeScript `modules/dogs/repository.ts`.

use crate::modules::dogs::errors::DogNameDuplicateError;
use crate::modules::dogs::types::{CreateDogInput, Dog};

#[async_trait::async_trait]
pub trait DogRepository: Send + Sync {
    async fn list_by_owner(&self, owner_id: &str) -> Vec<Dog>;
    async fn create_with_daily_goal(
        &self,
        owner_id: &str,
        input: &CreateDogInput,
    ) -> Result<Dog, DogNameDuplicateError>;
    async fn get_by_owner_and_id(&self, owner_id: &str, dog_id: &str) -> Option<Dog>;
}
