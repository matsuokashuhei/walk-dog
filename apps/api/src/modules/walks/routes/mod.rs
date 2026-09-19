//! Walk routes mounted at `/v1/walks`.

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::modules::walks::responses::{
    CompletedWalkBody, DetailEventBody, DetailTrackPointBody, EventBody, RecordingWalkBody,
    TrackPointBody,
};
use crate::modules::walks::use_cases::{
    self, AcceptTrackPointDeps, AcceptTrackPointResult, DeleteWalkResult, FinishWalkDeps,
    FinishWalkResult, GetWalkDetailResult, RecordEventCommand, RecordEventDeps, RecordEventResult,
    StartWalkResult, FINISH_CONFIRMATION_TIMEOUT_MS,
};
use crate::modules::walks::types::WalkEventType;
use crate::shared::http::authentication::Authenticated;
use crate::shared::http::error_contract::ErrorBody;
use crate::shared::http::request_id::RequestId;
use crate::shared::http::validation::invalid_input;

pub fn walk_routes() -> Router<AppState> {
    Router::new()
        .route("/active", get(get_active_walk_handler))
        .route("/", post(start_walk_handler))
        .route("/{walk_id}/finish", post(finish_walk_handler))
        .route("/{walk_id}/track-points", post(accept_track_point_handler))
        .route("/{walk_id}/events", post(record_event_handler))
        .route(
            "/{walk_id}",
            get(get_walk_detail_handler).delete(delete_walk_handler),
        )
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingWalkResponse {
    request_id: String,
    #[serde(flatten)]
    walk: RecordingWalkBody,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletedWalkResponse {
    request_id: String,
    #[serde(flatten)]
    walk: CompletedWalkBody,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WalkDetailResponse {
    request_id: String,
    #[serde(flatten)]
    walk: CompletedWalkBody,
    track_points: Vec<DetailTrackPointBody>,
    events: Vec<DetailEventBody>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TrackPointResponse {
    request_id: String,
    #[serde(flatten)]
    track_point: TrackPointBody,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EventResponse {
    request_id: String,
    #[serde(flatten)]
    event: EventBody,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct StartWalkBody {
    participant_dog_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FinishWalkBody {}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct AcceptTrackPointBody {
    recorded_at: String,
    latitude: f64,
    longitude: f64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RecordEventBody {
    event_id: String,
    participant_dog_id: String,
    #[serde(rename = "type")]
    event_type: String,
    occurred_at: String,
    latitude: f64,
    longitude: f64,
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

fn walk_not_found_jp(request_id: String) -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorBody {
            code: "NOT_FOUND".to_string(),
            message: "Walk が見つかりません。".to_string(),
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

fn track_point_idempotency_conflict(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "IDEMPOTENCY_CONFLICT".to_string(),
            message: "同じ取得時刻の TrackPoint が別の内容で送られています。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn walk_not_recording_delete(request_id: String) -> Response {
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

fn walk_not_recording_finish(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "WALK_NOT_RECORDING".to_string(),
            message: "この散歩は終了できません。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn walk_not_recording_track_point(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "WALK_NOT_RECORDING".to_string(),
            message: "この Walk は記録中ではありません。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn walk_not_recording_event(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "WALK_NOT_RECORDING".to_string(),
            message: "この散歩には記録できません。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

fn service_unavailable_finish(request_id: String) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(ErrorBody {
            code: "SERVICE_UNAVAILABLE".to_string(),
            message: "終了処理を完了できませんでした。もう一度お試しください。".to_string(),
            request_id,
            retryable: true,
        }),
    )
        .into_response()
}

fn retryable_internal_error(request_id: String) -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorBody {
            code: "INTERNAL_ERROR".to_string(),
            message: "一時的に送信できません。".to_string(),
            request_id,
            retryable: true,
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

fn has_microdegree_scale(value: f64) -> bool {
    let scaled = value * 1_000_000.0;
    (scaled - scaled.round()).abs() < 1e-6
}

fn valid_track_point_coords(latitude: f64, longitude: f64) -> bool {
    (-90.0..=90.0).contains(&latitude)
        && (-180.0..=180.0).contains(&longitude)
        && (-99.999_999..=99.999_999).contains(&latitude)
        && (-999.999_999..=999.999_999).contains(&longitude)
        && has_microdegree_scale(latitude)
        && has_microdegree_scale(longitude)
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
        DeleteWalkResult::NotRecording => walk_not_recording_delete(request_id.0),
    }
}

async fn accept_track_point_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    Path(walk_id): Path<String>,
    body: Result<Json<AcceptTrackPointBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    if uuid::Uuid::parse_str(&walk_id).is_err() {
        return walk_not_found_jp(request_id.0);
    }
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    let recorded_at = match body.recorded_at.parse::<jiff::Timestamp>() {
        Ok(value) => value,
        Err(_) => return invalid_input(request_id.0),
    };
    if !valid_track_point_coords(body.latitude, body.longitude) {
        return invalid_input(request_id.0);
    }
    match use_cases::accept_track_point(
        AcceptTrackPointDeps {
            owners: state.owner_repository.as_ref(),
            walks: state.walk_repository.as_ref(),
            queue: state.track_point_queue.as_ref(),
        },
        &principal.cognito_subject,
        &walk_id,
        recorded_at,
        body.latitude,
        body.longitude,
    )
    .await
    {
        AcceptTrackPointResult::Accepted(track_point) => (
            StatusCode::CREATED,
            Json(TrackPointResponse {
                request_id: request_id.0,
                track_point: TrackPointBody::from(&track_point),
            }),
        )
            .into_response(),
        AcceptTrackPointResult::NotFound => walk_not_found_jp(request_id.0),
        AcceptTrackPointResult::NotRecording => walk_not_recording_track_point(request_id.0),
        AcceptTrackPointResult::IdempotencyConflict => {
            track_point_idempotency_conflict(request_id.0)
        }
        AcceptTrackPointResult::EnqueueFailed => retryable_internal_error(request_id.0),
    }
}

async fn record_event_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    Path(walk_id): Path<String>,
    body: Result<Json<RecordEventBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    if uuid::Uuid::parse_str(&walk_id).is_err() {
        return walk_not_found_jp(request_id.0);
    }
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    if uuid::Uuid::parse_str(&body.event_id).is_err()
        || uuid::Uuid::parse_str(&body.participant_dog_id).is_err()
    {
        return invalid_input(request_id.0);
    }
    let Some(event_type) = WalkEventType::parse(&body.event_type) else {
        return invalid_input(request_id.0);
    };
    let occurred_at = match body.occurred_at.parse::<jiff::Timestamp>() {
        Ok(value) => value,
        Err(_) => return invalid_input(request_id.0),
    };
    if !valid_track_point_coords(body.latitude, body.longitude) {
        return invalid_input(request_id.0);
    }
    match use_cases::record_event(
        RecordEventDeps {
            owners: state.owner_repository.as_ref(),
            walks: state.walk_repository.as_ref(),
        },
        &principal.cognito_subject,
        RecordEventCommand {
            walk_id,
            event_id: body.event_id,
            participant_dog_id: body.participant_dog_id,
            event_type,
            occurred_at,
            latitude: body.latitude,
            longitude: body.longitude,
        },
    )
    .await
    {
        RecordEventResult::Recorded(recorded) => {
            let status = if recorded.created {
                StatusCode::CREATED
            } else {
                StatusCode::OK
            };
            (
                status,
                Json(EventResponse {
                    request_id: request_id.0,
                    event: EventBody::from(&recorded.event),
                }),
            )
                .into_response()
        }
        RecordEventResult::NotFound => walk_not_found_jp(request_id.0),
        RecordEventResult::NotRecording => walk_not_recording_event(request_id.0),
        RecordEventResult::IdempotencyConflict => idempotency_conflict(request_id.0),
    }
}

async fn finish_walk_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    Path(walk_id): Path<String>,
    headers: HeaderMap,
    body: Result<Json<FinishWalkBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    if uuid::Uuid::parse_str(&walk_id).is_err() {
        return not_found(request_id.0);
    }
    if body.is_err() {
        return invalid_input(request_id.0);
    }
    let Some(idempotency_key) = parse_idempotency_key(&headers) else {
        return invalid_input(request_id.0);
    };
    match use_cases::finish_walk(
        FinishWalkDeps {
            owners: state.owner_repository.as_ref(),
            walks: state.walk_repository.as_ref(),
            confirmed: state.confirmed_track_points.as_ref(),
            queue: state.track_point_queue.as_ref(),
            clock: state.finish_clock.as_ref(),
            sleep: state.finish_sleep.as_ref(),
            timeout_ms: FINISH_CONFIRMATION_TIMEOUT_MS,
        },
        &principal.cognito_subject,
        &walk_id,
        idempotency_key,
    )
    .await
    {
        FinishWalkResult::Finished(walk) => (
            StatusCode::OK,
            Json(CompletedWalkResponse {
                request_id: request_id.0,
                walk: CompletedWalkBody::from(&walk),
            }),
        )
            .into_response(),
        FinishWalkResult::NotFound => not_found(request_id.0),
        FinishWalkResult::NotRecording => walk_not_recording_finish(request_id.0),
        FinishWalkResult::IdempotencyConflict => idempotency_conflict(request_id.0),
        FinishWalkResult::ServiceUnavailable => service_unavailable_finish(request_id.0),
    }
}

async fn get_walk_detail_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    Path(walk_id): Path<String>,
) -> Response {
    if uuid::Uuid::parse_str(&walk_id).is_err() {
        return not_found(request_id.0);
    }
    match use_cases::get_walk_detail(
        state.owner_repository.as_ref(),
        state.walk_repository.as_ref(),
        state.confirmed_track_points.as_ref(),
        &principal.cognito_subject,
        &walk_id,
    )
    .await
    {
        GetWalkDetailResult::Found(detail) => (
            StatusCode::OK,
            Json(WalkDetailResponse {
                request_id: request_id.0,
                walk: CompletedWalkBody::from(&detail.walk),
                track_points: detail
                    .track_points
                    .iter()
                    .map(DetailTrackPointBody::from)
                    .collect(),
                events: detail.events.iter().map(DetailEventBody::from).collect(),
            }),
        )
            .into_response(),
        GetWalkDetailResult::NotFound => not_found(request_id.0),
    }
}
