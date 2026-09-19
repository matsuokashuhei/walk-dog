//! Dog routes mounted at `/v1/dogs`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::app::AppState;
use crate::modules::dogs::responses::DogBody;
use crate::modules::dogs::types::{Birthday, Gender};
use crate::modules::dogs::use_cases::{self, CreateDogResult, GetDogResult};
use crate::shared::http::authentication::Authenticated;
use crate::shared::http::error_contract::ErrorBody;
use crate::shared::http::request_id::RequestId;
use crate::shared::http::validation::{invalid_input, nonempty_trimmed};

pub fn dog_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_dogs_handler).post(create_dog_handler))
        .route("/{dog_id}", get(get_dog_handler))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DogListResponse {
    request_id: String,
    dogs: Vec<DogBody>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DogResponse {
    request_id: String,
    #[serde(flatten)]
    dog: DogBody,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CreateDogBody {
    name: String,
    gender: Gender,
    birthday: Option<BirthdayInput>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "precision", deny_unknown_fields)]
enum BirthdayInput {
    #[serde(rename = "unknown")]
    Unknown,
    #[serde(rename = "year")]
    Year { year: i32 },
    #[serde(rename = "month")]
    Month { year: i32, month: i32 },
    #[serde(rename = "day")]
    Day { year: i32, month: i32, day: i32 },
}

fn parse_birthday(input: Option<BirthdayInput>) -> Option<Birthday> {
    match input {
        None => Some(Birthday::Unknown),
        Some(BirthdayInput::Unknown) => Some(Birthday::Unknown),
        Some(BirthdayInput::Year { year }) => Some(Birthday::Year { year }),
        Some(BirthdayInput::Month { year, month }) => {
            if (1..=12).contains(&month) {
                Some(Birthday::Month { year, month })
            } else {
                None
            }
        }
        Some(BirthdayInput::Day { year, month, day }) => {
            if (1..=12).contains(&month) && (1..=31).contains(&day) {
                Some(Birthday::Day { year, month, day })
            } else {
                None
            }
        }
    }
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

fn dog_name_duplicate(request_id: String) -> Response {
    (
        StatusCode::CONFLICT,
        Json(ErrorBody {
            code: "DOG_NAME_DUPLICATE".to_string(),
            message: "同じ名前のDogが既に存在します。".to_string(),
            request_id,
            retryable: false,
        }),
    )
        .into_response()
}

async fn list_dogs_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
) -> Response {
    let dogs = use_cases::list_dogs(
        state.owner_repository.as_ref(),
        state.dog_repository.as_ref(),
        &principal.cognito_subject,
    )
    .await;
    (
        StatusCode::OK,
        Json(DogListResponse {
            request_id: request_id.0,
            dogs: dogs.iter().map(DogBody::from).collect(),
        }),
    )
        .into_response()
}

async fn create_dog_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    body: Result<Json<CreateDogBody>, axum::extract::rejection::JsonRejection>,
) -> Response {
    let Json(body) = match body {
        Ok(v) => v,
        Err(_) => return invalid_input(request_id.0),
    };
    let Some(name) = nonempty_trimmed(&body.name) else {
        return invalid_input(request_id.0);
    };
    if name.chars().count() > 100 {
        return invalid_input(request_id.0);
    }
    let Some(birthday) = parse_birthday(body.birthday) else {
        return invalid_input(request_id.0);
    };
    match use_cases::create_dog(
        state.owner_repository.as_ref(),
        state.dog_repository.as_ref(),
        &principal.cognito_subject,
        name,
        body.gender,
        birthday,
    )
    .await
    {
        CreateDogResult::Created(dog) => (
            StatusCode::CREATED,
            Json(DogResponse {
                request_id: request_id.0,
                dog: DogBody::from(dog.as_ref()),
            }),
        )
            .into_response(),
        CreateDogResult::DuplicateName => dog_name_duplicate(request_id.0),
    }
}

async fn get_dog_handler(
    State(state): State<AppState>,
    request_id: RequestId,
    Authenticated(principal): Authenticated,
    Path(dog_id): Path<String>,
) -> Response {
    if uuid::Uuid::parse_str(&dog_id).is_err() {
        return not_found(request_id.0);
    }
    match use_cases::get_dog(
        state.owner_repository.as_ref(),
        state.dog_repository.as_ref(),
        &principal.cognito_subject,
        &dog_id,
    )
    .await
    {
        GetDogResult::Found(dog) => (
            StatusCode::OK,
            Json(DogResponse {
                request_id: request_id.0,
                dog: DogBody::from(dog.as_ref()),
            }),
        )
            .into_response(),
        GetDogResult::NotFound => not_found(request_id.0),
    }
}
