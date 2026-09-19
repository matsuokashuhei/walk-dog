//! Auth routes mounted at `/v1/auth`.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;

use crate::app::AppState;
use crate::modules::auth::responses::{
    to_authentication_response, ChallengeResponse, CodeDeliveryBody, SignInChallengeResponse,
};
use crate::modules::auth::types::{
    SignOutResult, StartSignInResult, StartSignUpResult, VerifySignInResult, VerifySignUpResult,
};
use crate::modules::auth::use_cases;
use crate::shared::http::authentication::{AccessToken, Authenticated};
use crate::shared::http::error_contract::ErrorBody;
use crate::shared::http::request_id::RequestId;
use crate::shared::http::validation::{invalid_input, is_valid_email, nonempty_trimmed};

#[derive(Debug, Deserialize)]
pub struct EmailBody {
    pub email: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignUpVerifyBody {
    pub username: String,
    pub session: Option<String>,
    pub code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInVerifyBody {
    pub username: String,
    pub session: String,
    pub code: String,
}

pub async fn sign_up_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    body: Result<Json<EmailBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    if !is_valid_email(&body.email) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "INVALID_INPUT".to_string(),
                message: "有効なメールアドレスを入力してください。".to_string(),
                request_id: request_id.0,
                retryable: false,
            }),
        )
            .into_response();
    }
    let result = use_cases::start_sign_up(state.auth_provider.as_ref(), &body.email).await;
    map_start_sign_up(request_id.0, result)
}

fn map_start_sign_up(request_id: String, result: StartSignUpResult) -> Response {
    match result {
        StartSignUpResult::Challenge {
            username,
            session,
            code_delivery,
        } => (
            StatusCode::OK,
            Json(ChallengeResponse {
                request_id,
                username,
                session,
                code_delivery: code_delivery.as_ref().map(CodeDeliveryBody::from),
            }),
        )
            .into_response(),
        StartSignUpResult::AlreadyConfirmed => (
            StatusCode::CONFLICT,
            Json(ErrorBody {
                code: "AUTHENTICATION_FAILED".to_string(),
                message: "アカウントの作成に失敗しました。サインインしてください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        StartSignUpResult::InvalidInput => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "INVALID_INPUT".to_string(),
                message: "有効なメールアドレスを入力してください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        StartSignUpResult::RateLimited => rate_limited(request_id),
    }
}

pub async fn sign_up_verify_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    body: Result<Json<SignUpVerifyBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    let Some(username) = nonempty_trimmed(&body.username) else {
        return invalid_input(request_id.0);
    };
    let Some(code) = nonempty_trimmed(&body.code) else {
        return invalid_input(request_id.0);
    };
    let session = match &body.session {
        None => None,
        Some(s) => {
            let Some(trimmed) = nonempty_trimmed(s) else {
                return invalid_input(request_id.0);
            };
            Some(trimmed.to_string())
        }
    };
    let result = use_cases::verify_sign_up(
        state.auth_provider.as_ref(),
        state.owner_repository.as_ref(),
        username,
        session.as_deref(),
        code,
    )
    .await;
    map_verify_sign_up(request_id.0, result)
}

fn map_verify_sign_up(request_id: String, result: VerifySignUpResult) -> Response {
    match result {
        VerifySignUpResult::Authenticated {
            authentication,
            owner,
        } => (
            StatusCode::OK,
            Json(to_authentication_response(
                request_id,
                &authentication,
                &owner,
            )),
        )
            .into_response(),
        VerifySignUpResult::CodeExpired => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "CODE_EXPIRED".to_string(),
                message: "コードの有効期限が切れました。最初からやり直してください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        VerifySignUpResult::InvalidCode => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "INVALID_CODE".to_string(),
                message:
                    "コードが正しくありません。同じコードで再試行するか、最初からやり直してください。"
                        .to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        VerifySignUpResult::CodeAlreadyUsed => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "CODE_ALREADY_USED".to_string(),
                message: "このコードは既に使用されています。サインインしてください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        VerifySignUpResult::AlreadyConfirmed => (
            StatusCode::CONFLICT,
            Json(ErrorBody {
                code: "AUTHENTICATION_FAILED".to_string(),
                message: "このアカウントは既に確認済みです。サインインしてください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        VerifySignUpResult::RateLimited => rate_limited(request_id),
        VerifySignUpResult::IncompleteAuthentication => incomplete_auth(request_id),
    }
}

pub async fn sign_in_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    body: Result<Json<EmailBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    if !is_valid_email(&body.email) {
        return invalid_input(request_id.0);
    }
    let result = use_cases::start_sign_in(state.auth_provider.as_ref(), &body.email).await;
    map_start_sign_in(request_id.0, result)
}

fn map_start_sign_in(request_id: String, result: StartSignInResult) -> Response {
    match result {
        StartSignInResult::Challenge {
            username,
            session,
            code_delivery,
        } => (
            StatusCode::OK,
            Json(SignInChallengeResponse {
                request_id,
                username,
                session,
                code_delivery: CodeDeliveryBody::from(&code_delivery),
            }),
        )
            .into_response(),
        StartSignInResult::AuthenticationFailed => (
            StatusCode::CONFLICT,
            Json(ErrorBody {
                code: "AUTHENTICATION_FAILED".to_string(),
                message: "サインインに失敗しました。入力内容を確認してください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        StartSignInResult::RateLimited => rate_limited(request_id),
        StartSignInResult::IncompleteChallenge => incomplete_auth(request_id),
    }
}

pub async fn sign_in_verify_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    body: Result<Json<SignInVerifyBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    let Some(username) = nonempty_trimmed(&body.username) else {
        return invalid_input(request_id.0);
    };
    let Some(session) = nonempty_trimmed(&body.session) else {
        return invalid_input(request_id.0);
    };
    let Some(code) = nonempty_trimmed(&body.code) else {
        return invalid_input(request_id.0);
    };
    let result = use_cases::verify_sign_in(
        state.auth_provider.as_ref(),
        state.owner_repository.as_ref(),
        username,
        session,
        code,
    )
    .await;
    map_verify_sign_in(request_id.0, result)
}

fn map_verify_sign_in(request_id: String, result: VerifySignInResult) -> Response {
    match result {
        VerifySignInResult::Authenticated {
            authentication,
            owner,
        } => (
            StatusCode::OK,
            Json(to_authentication_response(
                request_id,
                &authentication,
                &owner,
            )),
        )
            .into_response(),
        VerifySignInResult::CodeExpired => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "CODE_EXPIRED".to_string(),
                message: "コードの有効期限が切れました。コードを再送してください。".to_string(),
                request_id,
                retryable: true,
            }),
        )
            .into_response(),
        VerifySignInResult::InvalidCode => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "INVALID_CODE".to_string(),
                message:
                    "コードが正しくありません。同じコードで再試行するか、最初からやり直してください。"
                        .to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        VerifySignInResult::CodeAlreadyUsed => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                code: "CODE_ALREADY_USED".to_string(),
                message: "このコードは既に使用されています。サインインしてください。".to_string(),
                request_id,
                retryable: false,
            }),
        )
            .into_response(),
        VerifySignInResult::AuthenticationFailed => (
            StatusCode::CONFLICT,
            Json(ErrorBody {
                code: "AUTHENTICATION_FAILED".to_string(),
                message: "認証情報の有効期限が切れました。コードを再送してください。".to_string(),
                request_id,
                retryable: true,
            }),
        )
            .into_response(),
        VerifySignInResult::RateLimited => rate_limited(request_id),
        VerifySignInResult::IncompleteAuthentication => incomplete_auth(request_id),
    }
}

pub async fn sign_out_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    AccessToken(access_token): AccessToken,
) -> Response {
    let result = use_cases::sign_out(
        state.owner_repository.as_ref(),
        state.active_walk_commands.as_ref(),
        state.auth_provider.as_ref(),
        &principal.cognito_subject,
        &access_token,
    )
    .await;

    match result {
        SignOutResult::SignedOut => StatusCode::NO_CONTENT.into_response(),
        SignOutResult::AuthenticationFailed => (
            StatusCode::UNAUTHORIZED,
            Json(ErrorBody {
                code: "UNAUTHENTICATED".to_string(),
                message: "Authentication is required.".to_string(),
                request_id: request_id.0,
                retryable: false,
            }),
        )
            .into_response(),
        SignOutResult::RateLimited => rate_limited(request_id.0),
    }
}

fn rate_limited(request_id: String) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(ErrorBody {
            code: "RATE_LIMITED".to_string(),
            message: "しばらく待ってから再試行してください。".to_string(),
            request_id,
            retryable: true,
        }),
    )
        .into_response()
}

fn incomplete_auth(request_id: String) -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorBody {
            code: "INTERNAL_SERVER_ERROR".to_string(),
            message: "認証情報の取得に失敗しました。".to_string(),
            request_id,
            retryable: true,
        }),
    )
        .into_response()
}
