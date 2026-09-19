//! Authenticated principal extracted from a Cognito access token.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Principal {
    pub cognito_subject: String,
}

#[async_trait::async_trait]
pub trait AccessTokenVerifier: Send + Sync {
    async fn verify(&self, access_token: &str) -> Result<Principal, ()>;
}
