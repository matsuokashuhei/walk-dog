use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

use crate::app::AppState;
use crate::modules::health::{check_health, HealthStatus};
use crate::shared::http::error_contract::ErrorBody;
use crate::shared::http::request_id::RequestId;

#[derive(Debug, Serialize)]
pub struct HealthOkBody {
    pub status: &'static str,
}

pub async fn health_handler(
    State(state): State<AppState>,
    request_id: RequestId,
) -> Response {
    match check_health(state.pings.as_ref()).await {
        HealthStatus::Ok => (StatusCode::OK, Json(HealthOkBody { status: "ok" })).into_response(),
        HealthStatus::Unavailable => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorBody {
                code: "DEPENDENCY_UNAVAILABLE".to_string(),
                message: "A required dependency is unavailable.".to_string(),
                request_id: request_id.0,
                retryable: true,
            }),
        )
            .into_response(),
    }
}
