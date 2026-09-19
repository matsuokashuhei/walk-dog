//! Auth domain types — mirrors TypeScript `modules/auth/types.ts`.

use crate::modules::owners::types::Owner;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodeDelivery {
    pub destination: String,
    pub attribute: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Authentication {
    pub subject: String,
    pub access_token: String,
    pub id_token: String,
    pub refresh_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartSignUpResult {
    Challenge {
        username: String,
        session: Option<String>,
        code_delivery: Option<CodeDelivery>,
    },
    AlreadyConfirmed,
    InvalidInput,
    RateLimited,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartSignInResult {
    Challenge {
        username: String,
        session: String,
        code_delivery: CodeDelivery,
    },
    AuthenticationFailed,
    RateLimited,
    IncompleteChallenge,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VerifySignUpResult {
    Authenticated {
        authentication: Authentication,
        owner: Owner,
    },
    CodeExpired,
    InvalidCode,
    CodeAlreadyUsed,
    AlreadyConfirmed,
    RateLimited,
    IncompleteAuthentication,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VerifySignInResult {
    Authenticated {
        authentication: Authentication,
        owner: Owner,
    },
    CodeExpired,
    InvalidCode,
    CodeAlreadyUsed,
    AuthenticationFailed,
    RateLimited,
    IncompleteAuthentication,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignOutResult {
    SignedOut,
    AuthenticationFailed,
    RateLimited,
}
