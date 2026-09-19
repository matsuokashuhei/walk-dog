//! Sign-out use case — mirrors TypeScript `createSignOut`.

use crate::modules::auth::provider::{AuthProvider, SignOutProviderResult};
use crate::modules::auth::types::SignOutResult;
use crate::modules::owners::repository::OwnerRepository;
use crate::modules::walks::ActiveWalkCommands;

pub async fn sign_out(
    owners: &dyn OwnerRepository,
    active_walks: &dyn ActiveWalkCommands,
    provider: &dyn AuthProvider,
    cognito_subject: &str,
    access_token: &str,
) -> SignOutResult {
    let owner = owners.resolve_by_cognito_subject(cognito_subject).await;
    active_walks.fail_if_present(&owner.owner_id).await;
    match provider.sign_out(access_token).await {
        SignOutProviderResult::SignedOut => SignOutResult::SignedOut,
        SignOutProviderResult::AuthenticationFailed => SignOutResult::AuthenticationFailed,
        SignOutProviderResult::RateLimited => SignOutResult::RateLimited,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::auth::provider::{
        ResendSignUpCodeProviderResult, SignUpProviderResult, StartSignInProviderResult,
        VerifySignInProviderResult, VerifySignUpProviderResult,
    };
    use crate::modules::owners::types::Owner;
    use std::sync::atomic::{AtomicBool, Ordering};

    struct FakeAuth {
        signed_out: AtomicBool,
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
            self.signed_out.store(true, Ordering::SeqCst);
            SignOutProviderResult::SignedOut
        }
    }

    struct FakeOwners;

    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, _: &str) -> Owner {
            Owner {
                owner_id: "o1".into(),
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

    struct FakeWalks {
        failed: AtomicBool,
    }

    #[async_trait::async_trait]
    impl ActiveWalkCommands for FakeWalks {
        async fn fail_if_present(&self, owner_id: &str) {
            assert_eq!(owner_id, "o1");
            self.failed.store(true, Ordering::SeqCst);
        }
    }

    #[tokio::test]
    async fn fails_active_walk_then_signs_out() {
        let auth = FakeAuth {
            signed_out: AtomicBool::new(false),
        };
        let walks = FakeWalks {
            failed: AtomicBool::new(false),
        };
        let result = sign_out(&FakeOwners, &walks, &auth, "sub", "token").await;
        assert_eq!(result, SignOutResult::SignedOut);
        assert!(walks.failed.load(Ordering::SeqCst));
        assert!(auth.signed_out.load(Ordering::SeqCst));
    }
}
