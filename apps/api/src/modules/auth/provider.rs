//! Auth provider outcomes and trait — mirrors TypeScript `modules/auth/provider.ts`.

use crate::modules::auth::types::{Authentication, CodeDelivery};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignUpProviderResult {
    SignedUp {
        session: Option<String>,
        code_delivery: Option<CodeDelivery>,
    },
    UsernameExists,
    InvalidInput,
    RateLimited,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResendSignUpCodeProviderResult {
    CodeSent {
        code_delivery: Option<CodeDelivery>,
    },
    AlreadyConfirmed,
    RateLimited,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartSignInProviderResult {
    Challenge {
        session: String,
        code_delivery: CodeDelivery,
    },
    IncompleteChallenge,
    AuthenticationFailed,
    RateLimited,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VerifySignUpProviderResult {
    Authenticated { authentication: Authentication },
    CodeExpired,
    InvalidCode,
    CodeAlreadyUsed,
    AlreadyConfirmed,
    RateLimited,
    IncompleteAuthentication,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VerifySignInProviderResult {
    Authenticated { authentication: Authentication },
    CodeExpired,
    InvalidCode,
    CodeAlreadyUsed,
    AuthenticationFailed,
    RateLimited,
    IncompleteAuthentication,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignOutProviderResult {
    SignedOut,
    AuthenticationFailed,
    RateLimited,
}

#[async_trait::async_trait]
pub trait AuthProvider: Send + Sync {
    async fn sign_up(&self, email: &str) -> SignUpProviderResult;
    async fn resend_sign_up_code(&self, email: &str) -> ResendSignUpCodeProviderResult;
    async fn start_sign_in(
        &self,
        email: &str,
        session: Option<&str>,
    ) -> StartSignInProviderResult;
    async fn verify_sign_up(
        &self,
        username: &str,
        session: Option<&str>,
        code: &str,
    ) -> VerifySignUpProviderResult;
    async fn verify_sign_in(
        &self,
        username: &str,
        session: &str,
        code: &str,
    ) -> VerifySignInProviderResult;
    async fn sign_out(&self, access_token: &str) -> SignOutProviderResult;
}
