//! Shared request validation helpers.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::shared::http::error_contract::ErrorBody;

pub fn invalid_input(request_id: String) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorBody {
            code: "INVALID_INPUT".to_string(),
            message: "入力内容を確認してください。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

/// Approximate Zod `z.email()` — nonempty local@domain with a dot in the domain.
pub fn is_valid_email(email: &str) -> bool {
    let email = email.trim();
    if email.is_empty() || email.contains(char::is_whitespace) {
        return false;
    }
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !domain.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
}

pub fn nonempty_trimmed(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}
