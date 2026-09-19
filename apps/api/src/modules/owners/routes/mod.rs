//! Owner routes mounted at `/v1/owner`.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::modules::auth::responses::OwnerBody;
use crate::modules::owners::use_cases;
use crate::shared::http::authentication::Authenticated;
use crate::shared::http::request_id::RequestId;
use crate::shared::http::validation::{invalid_input, nonempty_trimmed};

pub fn owner_routes() -> Router<AppState> {
    Router::new().route("/", get(get_owner_handler).patch(patch_owner_handler))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OwnerResponse {
    request_id: String,
    #[serde(flatten)]
    owner: OwnerBody,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct UpdateOwnerBody {
    display_name: String,
}

async fn get_owner_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
) -> Response {
    let owner = use_cases::get_owner(
        state.owner_repository.as_ref(),
        &principal.cognito_subject,
    )
    .await;
    (
        StatusCode::OK,
        Json(OwnerResponse {
            request_id: request_id.0,
            owner: OwnerBody::from(&owner),
        }),
    )
        .into_response()
}

async fn patch_owner_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    body: Result<Json<UpdateOwnerBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    let Some(display_name) = nonempty_trimmed(&body.display_name) else {
        return invalid_input(request_id.0);
    };
    if display_name.chars().count() > 100 {
        return invalid_input(request_id.0);
    }
    let owner = use_cases::update_owner_display_name(
        state.owner_repository.as_ref(),
        &principal.cognito_subject,
        display_name,
    )
    .await;
    (
        StatusCode::OK,
        Json(OwnerResponse {
            request_id: request_id.0,
            owner: OwnerBody::from(&owner),
        }),
    )
        .into_response()
}
