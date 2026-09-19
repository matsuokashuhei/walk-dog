//! Walk routes mounted at `/v1/walks`.

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::modules::walks::responses::RecordingWalkBody;
use crate::modules::walks::use_cases::{self, DeleteWalkResult, StartWalkResult};
use crate::shared::http::authentication::Authenticated;
use crate::shared::http::error_contract::ErrorBody;
use crate::shared::http::request_id::RequestId;
use crate::shared::http::validation::invalid_input;

pub fn walk_routes() -> Router<AppState> {
    Router::new()
        .route("/active", get(get_active_walk_handler))
        .route("/", post(start_walk_handler))
        .route("/{walk_id}", delete(delete_walk_handler))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingWalkResponse {
    request_id: String,
    #[serde(flatten)]
    walk: RecordingWalkBody,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct StartWalkBody {
    participant_dog_ids: Vec<String>,
}

fn not_found(request_id: String) -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorBody {
            code: "NOT_FOUND".to_string(),
            message: "The requested resource was not found.".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn active_walk_exists(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "ACTIVE_WALK_EXISTS".to_string(),
            message: "すでに記録中の散歩があります。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn idempotency_conflict(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "IDEMPOTENCY_CONFLICT".to_string(),
            message: "同じ要求を完了できません。最初からやり直してください。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn walk_not_recording(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "WALK_NOT_RECORDING".to_string(),
            message: "この散歩は破棄できません。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn parse_idempotency_key(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get("idempotency-key")?.to_str().ok()?;
    if value.is_empty() || value.len() > 256 {
        return None;
    }
    Some(value)
}

fn valid_participant_dog_ids(ids: &[String]) -> bool {
    if ids.is_empty() {
        return false;
    }
    let mut seen = std::collections::HashSet::with_capacity(ids.len());
    for id in ids {
        if uuid::Uuid::parse_str(id).is_err() {
            return false;
        }
        if !seen.insert(id.as_str()) {
            return false;
        }
    }
    true
}

async fn get_active_walk_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
) -> Response {
    match use_cases::get_active_walk(
        state.owner_repository.as_ref(),
        state.walk_repository.as_ref(),
        &principal.cognito_subject,
    )
    .await
    {
        Some(walk) => (
            StatusCode::OK,
            Json(RecordingWalkResponse {
                request_id: request_id.0,
                walk: RecordingWalkBody::from(&walk),
            }),
        )
            .into_response(),
        None => StatusCode::NO_CONTENT.into_response(),
    }
}

async fn start_walk_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    headers: HeaderMap,
    body: Result<Json<StartWalkBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    let Some(idempotency_key) = parse_idempotency_key(&headers) else {
        return invalid_input(request_id.0);
    };
    if !valid_participant_dog_ids(&body.participant_dog_ids) {
        return invalid_input(request_id.0);
    }
    match use_cases::start_walk(
        state.owner_repository.as_ref(),
        state.walk_repository.as_ref(),
        &principal.cognito_subject,
        body.participant_dog_ids,
        idempotency_key,
    )
    .await
    {
        StartWalkResult::Started(walk) => (
            StatusCode::CREATED,
            Json(RecordingWalkResponse {
                request_id: request_id.0,
                walk: RecordingWalkBody::from(walk.as_ref()),
            }),
        )
            .into_response(),
        StartWalkResult::NotFound => not_found(request_id.0),
        StartWalkResult::ActiveWalkExists => active_walk_exists(request_id.0),
        StartWalkResult::IdempotencyConflict => idempotency_conflict(request_id.0),
    }
}

async fn delete_walk_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    Path(walk_id): Path<String>,
) -> Response {
    if uuid::Uuid::parse_str(&walk_id).is_err() {
        return not_found(request_id.0);
    }
    match use_cases::delete_walk(
        state.owner_repository.as_ref(),
        state.walk_repository.as_ref(),
        &principal.cognito_subject,
        &walk_id,
    )
    .await
    {
        DeleteWalkResult::Deleted => StatusCode::NO_CONTENT.into_response(),
        DeleteWalkResult::NotFound => not_found(request_id.0),
        DeleteWalkResult::NotRecording => walk_not_recording(request_id.0),
    }
}
