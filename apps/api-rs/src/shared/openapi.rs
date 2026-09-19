//! Hand-maintained OpenAPI document (title/version match TypeScript API).
//! Choice: static JSON at GET `/openapi.json` instead of full utoipa for Phase 1 speed.

use axum::response::IntoResponse;
use axum::Json;

pub async fn openapi_handler() -> impl IntoResponse {
    Json(serde_json::from_str::<serde_json::Value>(OPENAPI_JSON).expect("openapi json"))
}

const OPENAPI_JSON: &str = include_str!("openapi.json");
