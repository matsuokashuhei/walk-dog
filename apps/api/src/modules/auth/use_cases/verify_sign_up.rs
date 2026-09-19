//! Verify sign-up use case — mirrors TypeScript `createVerifySignUp`.

use crate::modules::auth::provider::{AuthProvider, VerifySignUpProviderResult};
use crate::modules::auth::types::VerifySignUpResult;
use crate::modules::owners::repository::OwnerRepository;

pub async fn verify_sign_up(
    provider: &dyn AuthProvider,
    owners: &dyn OwnerRepository,
    username: &str,
    session: Option<&str>,
    code: &str,
) -> VerifySignUpResult {
    match provider.verify_sign_up(username, session, code).await {
        VerifySignUpProviderResult::Authenticated { authentication } => {
            let owner = owners
                .resolve_by_cognito_subject(&authentication.subject)
                .await;
            VerifySignUpResult::Authenticated {
                authentication,
                owner,
            }
        }
        VerifySignUpProviderResult::CodeExpired => VerifySignUpResult::CodeExpired,
        VerifySignUpProviderResult::InvalidCode => VerifySignUpResult::InvalidCode,
        VerifySignUpProviderResult::CodeAlreadyUsed => VerifySignUpResult::CodeAlreadyUsed,
        VerifySignUpProviderResult::AlreadyConfirmed => VerifySignUpResult::AlreadyConfirmed,
        VerifySignUpProviderResult::RateLimited => VerifySignUpResult::RateLimited,
        VerifySignUpProviderResult::IncompleteAuthentication => {
            VerifySignUpResult::IncompleteAuthentication
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::auth::provider::{
        ResendSignUpCodeProviderResult, SignOutProviderResult, SignUpProviderResult,
        StartSignInProviderResult, VerifySignInProviderResult,
    };
    use crate::modules::auth::types::Authentication;
    use crate::modules::owners::types::Owner;
    use std::sync::Mutex;

    struct FakeAuth {
        result: Mutex<VerifySignUpProviderResult>,
    }

    #[async_trait::async_trait]
    impl AuthProvider for FakeAuth {
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
            self.result.lock().unwrap().clone()
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

    struct FakeOwners {
        subject: Mutex<Option<String>>,
    }

    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, cognito_subject: &str) -> Owner {
            *self.subject.lock().unwrap() = Some(cognito_subject.to_string());
            Owner {
                owner_id: "owner-1".into(),
                display_name: None,
                avatar_url: None,
                created_at: jiff::Timestamp::from_second(1).unwrap(),
                updated_at: jiff::Timestamp::from_second(1).unwrap(),
            }
        }
        async fn update_display_name(&self, _: &str, _: &str) -> Owner {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn authenticated_resolves_owner() {
        let provider = FakeAuth {
            result: Mutex::new(VerifySignUpProviderResult::Authenticated {
                authentication: Authentication {
                    subject: "sub-1".into(),
                    access_token: "a".into(),
                    id_token: "i".into(),
                    refresh_token: "r".into(),
                },
            }),
        };
        let owners = FakeOwners {
            subject: Mutex::new(None),
        };
        let result = verify_sign_up(&provider, &owners, "u", Some("s"), "123456").await;
        match result {
            VerifySignUpResult::Authenticated { owner, .. } => {
                assert_eq!(owner.owner_id, "owner-1");
                assert_eq!(owners.subject.lock().unwrap().as_deref(), Some("sub-1"));
            }
            other => panic!("unexpected {other:?}"),
        }
    }
}
