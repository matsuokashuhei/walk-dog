//! Start sign-in use case — mirrors TypeScript `createStartSignIn`.

use crate::modules::auth::provider::{AuthProvider, StartSignInProviderResult};
use crate::modules::auth::types::StartSignInResult;

pub async fn start_sign_in(provider: &dyn AuthProvider, email: &str) -> StartSignInResult {
    match provider.start_sign_in(email, None).await {
        StartSignInProviderResult::Challenge {
            session,
            code_delivery,
        } => StartSignInResult::Challenge {
            username: email.to_string(),
            session,
            code_delivery,
        },
        StartSignInProviderResult::IncompleteChallenge => StartSignInResult::IncompleteChallenge,
        StartSignInProviderResult::AuthenticationFailed => StartSignInResult::AuthenticationFailed,
        StartSignInProviderResult::RateLimited => StartSignInResult::RateLimited,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::auth::provider::{
        ResendSignUpCodeProviderResult, SignOutProviderResult, SignUpProviderResult,
        VerifySignInProviderResult, VerifySignUpProviderResult,
    };
    use crate::modules::auth::types::CodeDelivery;

    struct OkAuth;

    #[async_trait::async_trait]
    impl AuthProvider for OkAuth {
        async fn sign_up(&self, _: &str) -> SignUpProviderResult {
            unreachable!()
        }
        async fn resend_sign_up_code(&self, _: &str) -> ResendSignUpCodeProviderResult {
            unreachable!()
        }
        async fn start_sign_in(&self, _: &str, _: Option<&str>) -> StartSignInProviderResult {
            StartSignInProviderResult::Challenge {
                session: "sess".into(),
                code_delivery: CodeDelivery {
                    destination: "x".into(),
                    attribute: "email".into(),
                },
            }
        }
        async fn verify_sign_up(
            &self,
            _: &str,
            _: Option<&str>,
            _: &str,
        ) -> VerifySignUpProviderResult {
            unreachable!()
        }
        async fn verify_sign_in(
            &self,
            _: &str,
            _: &str,
            _: &str,
        ) -> VerifySignInProviderResult {
            unreachable!()
        }
        async fn sign_out(&self, _: &str) -> SignOutProviderResult {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn challenge_maps_username() {
        let result = start_sign_in(&OkAuth, "a@b.c").await;
        assert!(matches!(
            result,
            StartSignInResult::Challenge { username, .. } if username == "a@b.c"
        ));
    }
}
