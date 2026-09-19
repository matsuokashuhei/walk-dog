//! Minimal active-walk command surface used by sign-out.

#[async_trait::async_trait]
pub trait ActiveWalkCommands: Send + Sync {
    async fn fail_if_present(&self, owner_id: &str);
}
