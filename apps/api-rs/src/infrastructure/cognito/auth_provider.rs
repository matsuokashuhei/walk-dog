//! Cognito AuthProvider using aws-sdk-cognitoidentityprovider.

use aws_sdk_cognitoidentityprovider::error::ProvideErrorMetadata;
use aws_sdk_cognitoidentityprovider::operation::confirm_sign_up::ConfirmSignUpError;
use aws_sdk_cognitoidentityprovider::operation::global_sign_out::GlobalSignOutError;
use aws_sdk_cognitoidentityprovider::operation::initiate_auth::InitiateAuthError;
use aws_sdk_cognitoidentityprovider::operation::resend_confirmation_code::ResendConfirmationCodeError;
use aws_sdk_cognitoidentityprovider::operation::respond_to_auth_challenge::RespondToAuthChallengeError;
use aws_sdk_cognitoidentityprovider::operation::sign_up::SignUpError;
use aws_sdk_cognitoidentityprovider::types::{
    AuthenticationResultType, ChallengeNameType, CodeDeliveryDetailsType,
};
use aws_sdk_cognitoidentityprovider::Client;
use base64::Engine;

use crate::infrastructure::config::CognitoConfig;
use crate::modules::auth::provider::{
    AuthProvider, ResendSignUpCodeProviderResult, SignOutProviderResult, SignUpProviderResult,
    StartSignInProviderResult, VerifySignInProviderResult, VerifySignUpProviderResult,
};
use crate::modules::auth::types::{Authentication, CodeDelivery};

pub struct CognitoAuthProvider {
    client: Client,
    client_id: String,
}

impl CognitoAuthProvider {
    pub async fn from_config(config: &CognitoConfig) -> Self {
        let aws_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(aws_config::Region::new(config.region.clone()))
            .load()
            .await;
        Self {
            client: Client::new(&aws_config),
            client_id: config.client_id.clone(),
        }
    }
}

fn code_delivery_from_details(details: Option<&CodeDeliveryDetailsType>) -> Option<CodeDelivery> {
    details.map(|d| CodeDelivery {
        destination: d.destination().unwrap_or("").to_string(),
        attribute: d.attribute_name().unwrap_or("").to_string(),
    })
}

fn is_rate_limited(code: Option<&str>) -> bool {
    matches!(
        code,
        Some("TooManyRequestsException" | "LimitExceededException")
    )
}

fn decode_id_token_subject(id_token: &str) -> Option<String> {
    let payload = id_token.split('.').nth(1)?;
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(payload))
        .ok()?;
    let value: serde_json::Value = serde_json::from_slice(&decoded).ok()?;
    value.get("sub")?.as_str().map(str::to_owned)
}

fn authentication_from_result(
    auth_result: Option<&AuthenticationResultType>,
) -> Option<Authentication> {
    let auth_result = auth_result?;
    let access_token = auth_result.access_token()?.to_string();
    let id_token = auth_result.id_token()?.to_string();
    let refresh_token = auth_result.refresh_token()?.to_string();
    let subject = decode_id_token_subject(&id_token)?;
    Some(Authentication {
        subject,
        access_token,
        id_token,
        refresh_token,
    })
}

#[async_trait::async_trait]
impl AuthProvider for CognitoAuthProvider {
    async fn sign_up(&self, email: &str) -> SignUpProviderResult {
        let result = self
            .client
            .sign_up()
            .client_id(&self.client_id)
            .username(email)
            .user_attributes(
                aws_sdk_cognitoidentityprovider::types::AttributeType::builder()
                    .name("email")
                    .value(email)
                    .build()
                    .expect("email attribute"),
            )
            .send()
            .await;

        match result {
            Ok(output) => SignUpProviderResult::SignedUp {
                session: output.session,
                code_delivery: code_delivery_from_details(output.code_delivery_details.as_ref()),
            },
            Err(err) => {
                let service = err.into_service_error();
                if matches!(service, SignUpError::UsernameExistsException(_)) {
                    return SignUpProviderResult::UsernameExists;
                }
                if matches!(service, SignUpError::InvalidParameterException(_)) {
                    return SignUpProviderResult::InvalidInput;
                }
                if is_rate_limited(service.code()) {
                    return SignUpProviderResult::RateLimited;
                }
                panic!("unexpected Cognito sign_up error: {service:?}");
            }
        }
    }

    async fn resend_sign_up_code(&self, email: &str) -> ResendSignUpCodeProviderResult {
        let result = self
            .client
            .resend_confirmation_code()
            .client_id(&self.client_id)
            .username(email)
            .send()
            .await;

        match result {
            Ok(output) => ResendSignUpCodeProviderResult::CodeSent {
                code_delivery: code_delivery_from_details(output.code_delivery_details.as_ref()),
            },
            Err(err) => {
                let service = err.into_service_error();
                if matches!(service, ResendConfirmationCodeError::InvalidParameterException(_)) {
                    return ResendSignUpCodeProviderResult::AlreadyConfirmed;
                }
                if is_rate_limited(service.code()) {
                    return ResendSignUpCodeProviderResult::RateLimited;
                }
                panic!("unexpected Cognito resend_confirmation_code error: {service:?}");
            }
        }
    }

    async fn start_sign_in(
        &self,
        email: &str,
        session: Option<&str>,
    ) -> StartSignInProviderResult {
        let mut req = self
            .client
            .initiate_auth()
            .client_id(&self.client_id)
            .auth_flow(aws_sdk_cognitoidentityprovider::types::AuthFlowType::UserAuth)
            .auth_parameters("USERNAME", email)
            .auth_parameters("PREFERRED_CHALLENGE", "EMAIL_OTP");
        if let Some(session) = session {
            req = req.session(session);
        }
        let result = req.send().await;

        match result {
            Ok(output) => {
                if output.challenge_name != Some(ChallengeNameType::EmailOtp)
                    || output.session.is_none()
                {
                    return StartSignInProviderResult::IncompleteChallenge;
                }
                let destination = output
                    .challenge_parameters
                    .as_ref()
                    .and_then(|m| m.get("CODE_DELIVERY_DESTINATION"))
                    .cloned()
                    .unwrap_or_default();
                StartSignInProviderResult::Challenge {
                    session: output.session.expect("session checked"),
                    code_delivery: CodeDelivery {
                        destination,
                        attribute: "email".to_string(),
                    },
                }
            }
            Err(err) => {
                let service = err.into_service_error();
                if matches!(
                    service,
                    InitiateAuthError::UserNotFoundException(_)
                        | InitiateAuthError::UserNotConfirmedException(_)
                        | InitiateAuthError::NotAuthorizedException(_)
                ) {
                    return StartSignInProviderResult::AuthenticationFailed;
                }
                if is_rate_limited(service.code()) {
                    return StartSignInProviderResult::RateLimited;
                }
                panic!("unexpected Cognito initiate_auth error: {service:?}");
            }
        }
    }

    async fn verify_sign_up(
        &self,
        username: &str,
        session: Option<&str>,
        code: &str,
    ) -> VerifySignUpProviderResult {
        let mut confirm = self
            .client
            .confirm_sign_up()
            .client_id(&self.client_id)
            .username(username)
            .confirmation_code(code);
        if let Some(session) = session {
            confirm = confirm.session(session);
        }
        let confirm_output = match confirm.send().await {
            Ok(output) => output,
            Err(err) => {
                return map_verify_sign_up_error(err.into_service_error());
            }
        };

        let session_for_auth = confirm_output
            .session
            .as_deref()
            .or(session);

        let mut auth = self
            .client
            .initiate_auth()
            .client_id(&self.client_id)
            .auth_flow(aws_sdk_cognitoidentityprovider::types::AuthFlowType::UserAuth)
            .auth_parameters("USERNAME", username)
            .auth_parameters("PREFERRED_CHALLENGE", "EMAIL_OTP");
        if let Some(session) = session_for_auth {
            auth = auth.session(session);
        }

        match auth.send().await {
            Ok(output) => match authentication_from_result(output.authentication_result.as_ref())
            {
                Some(authentication) => VerifySignUpProviderResult::Authenticated { authentication },
                None => VerifySignUpProviderResult::IncompleteAuthentication,
            },
            Err(err) => {
                let service = err.into_service_error();
                if is_rate_limited(service.code()) {
                    return VerifySignUpProviderResult::RateLimited;
                }
                panic!("unexpected Cognito verify_sign_up initiate_auth error: {service:?}");
            }
        }
    }

    async fn verify_sign_in(
        &self,
        username: &str,
        session: &str,
        code: &str,
    ) -> VerifySignInProviderResult {
        let result = self
            .client
            .respond_to_auth_challenge()
            .client_id(&self.client_id)
            .challenge_name(ChallengeNameType::EmailOtp)
            .challenge_responses("USERNAME", username)
            .challenge_responses("EMAIL_OTP_CODE", code)
            .session(session)
            .send()
            .await;

        match result {
            Ok(output) => match authentication_from_result(output.authentication_result.as_ref()) {
                Some(authentication) => VerifySignInProviderResult::Authenticated { authentication },
                None => VerifySignInProviderResult::IncompleteAuthentication,
            },
            Err(err) => map_verify_sign_in_error(err.into_service_error()),
        }
    }

    async fn sign_out(&self, access_token: &str) -> SignOutProviderResult {
        let result = self
            .client
            .global_sign_out()
            .access_token(access_token)
            .send()
            .await;

        match result {
            Ok(_) => SignOutProviderResult::SignedOut,
            Err(err) => {
                let service = err.into_service_error();
                if matches!(service, GlobalSignOutError::NotAuthorizedException(_)) {
                    return SignOutProviderResult::AuthenticationFailed;
                }
                if is_rate_limited(service.code()) {
                    return SignOutProviderResult::RateLimited;
                }
                panic!("unexpected Cognito global_sign_out error: {service:?}");
            }
        }
    }
}

fn map_verify_sign_up_error(error: ConfirmSignUpError) -> VerifySignUpProviderResult {
    if matches!(error, ConfirmSignUpError::ExpiredCodeException(_)) {
        return VerifySignUpProviderResult::CodeExpired;
    }
    if matches!(error, ConfirmSignUpError::CodeMismatchException(_)) {
        return VerifySignUpProviderResult::InvalidCode;
    }
    if matches!(error, ConfirmSignUpError::AliasExistsException(_)) {
        return VerifySignUpProviderResult::CodeAlreadyUsed;
    }
    if matches!(error, ConfirmSignUpError::NotAuthorizedException(_)) {
        return VerifySignUpProviderResult::AlreadyConfirmed;
    }
    if is_rate_limited(error.code()) {
        return VerifySignUpProviderResult::RateLimited;
    }
    panic!("unexpected Cognito confirm_sign_up error: {error:?}");
}

fn map_verify_sign_in_error(error: RespondToAuthChallengeError) -> VerifySignInProviderResult {
    if matches!(error, RespondToAuthChallengeError::ExpiredCodeException(_)) {
        return VerifySignInProviderResult::CodeExpired;
    }
    if matches!(error, RespondToAuthChallengeError::CodeMismatchException(_)) {
        return VerifySignInProviderResult::InvalidCode;
    }
    if matches!(error, RespondToAuthChallengeError::AliasExistsException(_)) {
        return VerifySignInProviderResult::CodeAlreadyUsed;
    }
    if matches!(error, RespondToAuthChallengeError::NotAuthorizedException(_)) {
        return VerifySignInProviderResult::AuthenticationFailed;
    }
    if is_rate_limited(error.code()) {
        return VerifySignInProviderResult::RateLimited;
    }
    panic!("unexpected Cognito respond_to_auth_challenge error: {error:?}");
}
