//! Verify sign-in use case — mirrors TypeScript `createVerifySignIn`.

use crate::modules::auth::provider::{AuthProvider, VerifySignInProviderResult};
use crate::modules::auth::types::VerifySignInResult;
use crate::modules::owners::repository::OwnerRepository;

pub async fn verify_sign_in(
    provider: &dyn AuthProvider,
    owners: &dyn OwnerRepository,
    username: &str,
    session: &str,
    code: &str,
) -> VerifySignInResult {
    match provider.verify_sign_in(username, session, code).await {
        VerifySignInProviderResult::Authenticated { authentication } => {
            let owner = owners
                .resolve_by_cognito_subject(&authentication.subject)
                .await;
            VerifySignInResult::Authenticated {
                authentication,
                owner,
            }
        }
        VerifySignInProviderResult::CodeExpired => VerifySignInResult::CodeExpired,
        VerifySignInProviderResult::InvalidCode => VerifySignInResult::InvalidCode,
        VerifySignInProviderResult::CodeAlreadyUsed => VerifySignInResult::CodeAlreadyUsed,
        VerifySignInProviderResult::AuthenticationFailed => {
            VerifySignInResult::AuthenticationFailed
        }
        VerifySignInProviderResult::RateLimited => VerifySignInResult::RateLimited,
        VerifySignInProviderResult::IncompleteAuthentication => {
            VerifySignInResult::IncompleteAuthentication
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::auth::provider::{
        ResendSignUpCodeProviderResult, SignOutProviderResult, SignUpProviderResult,
        StartSignInProviderResult, VerifySignUpProviderResult,
    };
    use crate::modules::auth::types::Authentication;
    use crate::modules::owners::types::Owner;

    struct FailAuth;

    #[async_trait::async_trait]
    impl AuthProvider for FailAuth {
        async fn sign_up(&self, _: &str) -> SignUpProviderResult {
            unreachable!()
        }
        async fn resend_sign_up_code(&self, _: &str) -> ResendSignUpCodeProviderResult {
            unreachable!()
        }
        async fn start_sign_in(&self, _: &str, _: Option<&str>) -> StartSignInProviderResult {
            unreachable!()
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
            VerifySignInProviderResult::CodeExpired
        }
        async fn sign_out(&self, _: &str) -> SignOutProviderResult {
            unreachable!()
        }
    }

    struct UnusedOwners;

    #[async_trait::async_trait]
    impl OwnerRepository for UnusedOwners {
        async fn resolve_by_cognito_subject(&self, _: &str) -> Owner {
            unreachable!()
        }
        async fn update_display_name(&self, _: &str, _: &str) -> Owner {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn maps_provider_failure() {
        assert_eq!(
            verify_sign_in(&FailAuth, &UnusedOwners, "u", "s", "c").await,
            VerifySignInResult::CodeExpired
        );
    }

    #[allow(dead_code)]
    fn _auth_shape() -> Authentication {
        Authentication {
            subject: String::new(),
            access_token: String::new(),
            id_token: String::new(),
            refresh_token: String::new(),
        }
    }
}
