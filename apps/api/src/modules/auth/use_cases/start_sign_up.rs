//! Start sign-up use case — mirrors TypeScript `createStartSignUp`.

use crate::modules::auth::provider::{AuthProvider, SignUpProviderResult};
use crate::modules::auth::types::StartSignUpResult;

pub async fn start_sign_up(provider: &dyn AuthProvider, email: &str) -> StartSignUpResult {
    match provider.sign_up(email).await {
        SignUpProviderResult::SignedUp {
            session,
            code_delivery,
        } => StartSignUpResult::Challenge {
            username: email.to_string(),
            session,
            code_delivery,
        },
        SignUpProviderResult::UsernameExists => match provider.resend_sign_up_code(email).await {
            crate::modules::auth::provider::ResendSignUpCodeProviderResult::CodeSent {
                code_delivery,
            } => StartSignUpResult::Challenge {
                username: email.to_string(),
                session: None,
                code_delivery,
            },
            crate::modules::auth::provider::ResendSignUpCodeProviderResult::AlreadyConfirmed => {
                StartSignUpResult::AlreadyConfirmed
            }
            crate::modules::auth::provider::ResendSignUpCodeProviderResult::RateLimited => {
                StartSignUpResult::RateLimited
            }
        },
        SignUpProviderResult::InvalidInput => StartSignUpResult::InvalidInput,
        SignUpProviderResult::RateLimited => StartSignUpResult::RateLimited,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::auth::provider::{
        ResendSignUpCodeProviderResult, SignOutProviderResult, StartSignInProviderResult,
        VerifySignInProviderResult, VerifySignUpProviderResult,
    };
    use crate::modules::auth::types::CodeDelivery;
    use std::sync::Mutex;

    struct FakeAuth {
        sign_up: Mutex<Vec<SignUpProviderResult>>,
        resend: Mutex<Vec<ResendSignUpCodeProviderResult>>,
    }

    #[async_trait::async_trait]
    impl AuthProvider for FakeAuth {
        async fn sign_up(&self, _email: &str) -> SignUpProviderResult {
            self.sign_up.lock().unwrap().remove(0)
        }
        async fn resend_sign_up_code(&self, _email: &str) -> ResendSignUpCodeProviderResult {
            self.resend.lock().unwrap().remove(0)
        }
        async fn start_sign_in(
            &self,
            _email: &str,
            _session: Option<&str>,
        ) -> StartSignInProviderResult {
            unreachable!()
        }
        async fn verify_sign_up(
            &self,
            _username: &str,
            _session: Option<&str>,
            _code: &str,
        ) -> VerifySignUpProviderResult {
            unreachable!()
        }
        async fn verify_sign_in(
            &self,
            _username: &str,
            _session: &str,
            _code: &str,
        ) -> VerifySignInProviderResult {
            unreachable!()
        }
        async fn sign_out(&self, _access_token: &str) -> SignOutProviderResult {
            unreachable!()
        }
    }

    #[tokio::test]
    async fn signed_up_returns_challenge() {
        let provider = FakeAuth {
            sign_up: Mutex::new(vec![SignUpProviderResult::SignedUp {
                session: Some("sess".into()),
                code_delivery: Some(CodeDelivery {
                    destination: "a@b.c".into(),
                    attribute: "email".into(),
                }),
            }]),
            resend: Mutex::new(vec![]),
        };
        let result = start_sign_up(&provider, "a@b.c").await;
        assert_eq!(
            result,
            StartSignUpResult::Challenge {
                username: "a@b.c".into(),
                session: Some("sess".into()),
                code_delivery: Some(CodeDelivery {
                    destination: "a@b.c".into(),
                    attribute: "email".into(),
                }),
            }
        );
    }

    #[tokio::test]
    async fn username_exists_resends_with_null_session() {
        let provider = FakeAuth {
            sign_up: Mutex::new(vec![SignUpProviderResult::UsernameExists]),
            resend: Mutex::new(vec![ResendSignUpCodeProviderResult::CodeSent {
                code_delivery: Some(CodeDelivery {
                    destination: "a***@b.c".into(),
                    attribute: "email".into(),
                }),
            }]),
        };
        let result = start_sign_up(&provider, "a@b.c").await;
        assert_eq!(
            result,
            StartSignUpResult::Challenge {
                username: "a@b.c".into(),
                session: None,
                code_delivery: Some(CodeDelivery {
                    destination: "a***@b.c".into(),
                    attribute: "email".into(),
                }),
            }
        );
    }

    #[tokio::test]
    async fn username_exists_already_confirmed() {
        let provider = FakeAuth {
            sign_up: Mutex::new(vec![SignUpProviderResult::UsernameExists]),
            resend: Mutex::new(vec![ResendSignUpCodeProviderResult::AlreadyConfirmed]),
        };
        assert_eq!(
            start_sign_up(&provider, "a@b.c").await,
            StartSignUpResult::AlreadyConfirmed
        );
    }
}
