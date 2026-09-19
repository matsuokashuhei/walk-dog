//! Bearer authentication middleware — mirrors TypeScript `authentication-middleware.ts`.

use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::app::AppState;
use crate::shared::http::access_token::Principal;
use crate::shared::http::error_contract::ErrorBody;
use crate::shared::http::request_id::RequestId;

/// Access token captured by authentication middleware for handlers that need it (sign-out).
#[derive(Debug, Clone)]
pub struct AccessToken(pub String);

/// Match `/^Bearer\s+(\S+)$/i`.
pub fn bearer_access_token(authorization: Option<&str>) -> Option<&str> {
    let authorization = authorization?;
    if authorization.len() < 8 {
        return None;
    }
    if !authorization[..6].eq_ignore_ascii_case("bearer") {
        return None;
    }
    let after_bearer = &authorization[6..];
    let token = after_bearer.trim_start();
    if token.is_empty() || token.bytes().any(|b| b.is_ascii_whitespace()) {
        return None;
    }
    if after_bearer.len() == token.len() {
        return None;
    }
    Some(token)
}

fn unauthenticated(request_id: String) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(ErrorBody {
            code: "UNAUTHENTICATED".to_string(),
            message: "Authentication is required.".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

pub async fn authentication_middleware(
    State(state): State<AppState>,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let request_id = request
        .extensions()
        .get::<RequestId>()
        .map(|r| r.0.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let authorization = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let Some(access_token) = bearer_access_token(authorization.as_deref()) else {
        return unauthenticated(request_id);
    };
    let access_token = access_token.to_string();

    let principal = match state.access_token_verifier.verify(&access_token).await {
        Ok(principal) => principal,
        Err(()) => return unauthenticated(request_id),
    };

    request.extensions_mut().insert(principal);
    request.extensions_mut().insert(AccessToken(access_token));
    next.run(request).await
}

/// Extractor for routes behind authentication middleware.
pub struct Authenticated(pub Principal);

impl<S> axum::extract::FromRequestParts<S> for Authenticated
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Principal>()
            .cloned()
            .map(Authenticated)
            .ok_or_else(|| {
                let request_id = parts
                    .extensions
                    .get::<RequestId>()
                    .map(|r| r.0.clone())
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                unauthenticated(request_id)
            })
    }
}

impl<S> axum::extract::FromRequestParts<S> for AccessToken
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts.extensions.get::<AccessToken>().cloned().ok_or_else(|| {
            let request_id = parts
                .extensions
                .get::<RequestId>()
                .map(|r| r.0.clone())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            unauthenticated(request_id)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bearer_token() {
        assert_eq!(
            bearer_access_token(Some("Bearer abc.def")),
            Some("abc.def")
        );
        assert_eq!(bearer_access_token(Some("bearer abc")), Some("abc"));
        assert_eq!(bearer_access_token(Some("Bearer")), None);
        assert_eq!(bearer_access_token(Some("Basic x")), None);
        assert_eq!(bearer_access_token(None), None);
    }
}
