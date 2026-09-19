use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use uuid::Uuid;

/// Request identifier from `X-Request-Id` or a newly generated UUID.
#[derive(Debug, Clone)]
pub struct RequestId(pub String);

impl<S: Send + Sync> FromRequestParts<S> for RequestId {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let value = parts
            .headers
            .get("x-request-id")
            .and_then(|v| v.to_str().ok())
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        Ok(RequestId(value))
    }
}
