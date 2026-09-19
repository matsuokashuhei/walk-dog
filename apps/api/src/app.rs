use std::sync::Arc;

use axum::http::{HeaderValue, Request, Response};
use axum::middleware::{self, Next};
use axum::routing::{get, post};
use axum::Router;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;

use crate::modules::auth::provider::AuthProvider;
use crate::modules::auth::routes::{
    sign_in_handler, sign_in_verify_handler, sign_out_handler, sign_up_handler,
    sign_up_verify_handler,
};
use crate::modules::dogs::repository::DogRepository;
use crate::modules::dogs::routes::dog_routes;
use crate::modules::health::routes::health_handler;
use crate::modules::health::HealthPings;
use crate::modules::owners::repository::OwnerRepository;
use crate::modules::owners::routes::owner_routes;
use crate::modules::walks::provider::{ConfirmTrackPoint, ConfirmedTrackPoints, TrackPointQueue};
use crate::modules::walks::repository::WalkRepository;
use crate::modules::walks::routes::walk_routes;
use crate::modules::walks::ActiveWalkCommands;
use crate::shared::http::access_token::AccessTokenVerifier;
use crate::shared::http::authentication::authentication_middleware;
use crate::shared::http::request_id::RequestId;
use crate::shared::openapi::openapi_handler;

#[derive(Clone)]
pub struct AppState {
    pub pings: Arc<dyn HealthPings>,
    pub auth_provider: Arc<dyn AuthProvider>,
    pub owner_repository: Arc<dyn OwnerRepository>,
    pub dog_repository: Arc<dyn DogRepository>,
    pub walk_repository: Arc<dyn WalkRepository>,
    pub access_token_verifier: Arc<dyn AccessTokenVerifier>,
    pub active_walk_commands: Arc<dyn ActiveWalkCommands>,
    pub track_point_queue: Arc<dyn TrackPointQueue>,
    pub confirmed_track_points: Arc<dyn ConfirmedTrackPoints>,
    pub confirm_track_point: Arc<dyn ConfirmTrackPoint>,
}

pub fn create_app(state: AppState) -> Router {
    let auth_protected = Router::new()
        .route("/sign-out", post(sign_out_handler))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            authentication_middleware,
        ));

    let auth = Router::new()
        .route("/sign-up", post(sign_up_handler))
        .route("/sign-up/verify", post(sign_up_verify_handler))
        .route("/sign-in", post(sign_in_handler))
        .route("/sign-in/verify", post(sign_in_verify_handler))
        .merge(auth_protected);

    let owner = owner_routes().route_layer(middleware::from_fn_with_state(
        state.clone(),
        authentication_middleware,
    ));

    let dogs = dog_routes().route_layer(middleware::from_fn_with_state(
        state.clone(),
        authentication_middleware,
    ));

    let walks = walk_routes().route_layer(middleware::from_fn_with_state(
        state.clone(),
        authentication_middleware,
    ));

    Router::new()
        .route("/health", get(health_handler))
        .route("/openapi.json", get(openapi_handler))
        .nest("/v1/auth", auth)
        .nest("/v1/owner", owner)
        .nest("/v1/dogs", dogs)
        .nest("/v1/walks", walks)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(middleware::from_fn(attach_request_id_header)),
        )
        .with_state(state)
}

async fn attach_request_id_header(
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Response<axum::body::Body> {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    request.extensions_mut().insert(RequestId(request_id.clone()));

    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::auth::provider::{
        ResendSignUpCodeProviderResult, SignOutProviderResult, SignUpProviderResult,
        StartSignInProviderResult, VerifySignInProviderResult, VerifySignUpProviderResult,
    };
    use crate::modules::auth::types::{Authentication, CodeDelivery};
    use crate::modules::dogs::errors::DogNameDuplicateError;
    use crate::modules::dogs::repository::DogRepository;
    use crate::modules::dogs::types::{
        Birthday, CreateDogInput, CurrentGoal, Dog, Gender, GoalPeriodLiteral,
    };
    use crate::modules::health::use_cases::check_health::BoxFut;
    use crate::modules::owners::types::Owner;
    use crate::modules::walks::errors::{
        ActiveWalkExistsError, IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
    };
    use crate::modules::walks::provider::{ConfirmTrackPoint, ConfirmedTrackPoints, TrackPointQueue};
    use crate::modules::walks::repository::{
        AcceptTrackPointError, FailWalkError, FinishWalkError, ListAcceptedError, RecordEventError,
        StartWalkError, WalkRepository,
    };
    use crate::modules::walks::types::{
        AcceptTrackPointInput, CompletedWalk, ConfirmedTrackPoint, FinishWalkInput, RecordingWalk,
        RecordEventInput, RecordedEvent, StartWalkInput, TrackPoint, WalkEvent, WalkEventType,
        WalkParticipant,
    };
    use crate::modules::walks::ActiveWalkCommands;
    use crate::shared::http::access_token::Principal;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use std::sync::Mutex;
    use tower::ServiceExt;

    struct OkPings;
    impl HealthPings for OkPings {
        fn ping_postgres(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }
        fn ping_worker(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }
    }

    struct DownPings;
    impl HealthPings for DownPings {
        fn ping_postgres(&self) -> BoxFut<'_> {
            Box::pin(async { Err(()) })
        }
        fn ping_worker(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }
    }

    struct FakeAuth {
        sign_up: Mutex<Vec<SignUpProviderResult>>,
        resend: Mutex<Vec<ResendSignUpCodeProviderResult>>,
        verify_sign_up: Mutex<Option<VerifySignUpProviderResult>>,
        sign_out: Mutex<SignOutProviderResult>,
    }

    impl Default for FakeAuth {
        fn default() -> Self {
            Self {
                sign_up: Mutex::new(vec![]),
                resend: Mutex::new(vec![]),
                verify_sign_up: Mutex::new(None),
                sign_out: Mutex::new(SignOutProviderResult::SignedOut),
            }
        }
    }

    #[async_trait::async_trait]
    impl AuthProvider for FakeAuth {
        async fn sign_up(&self, _: &str) -> SignUpProviderResult {
            self.sign_up.lock().unwrap().remove(0)
        }
        async fn resend_sign_up_code(&self, _: &str) -> ResendSignUpCodeProviderResult {
            self.resend.lock().unwrap().remove(0)
        }
        async fn start_sign_in(&self, _: &str, _: Option<&str>) -> StartSignInProviderResult {
            StartSignInProviderResult::AuthenticationFailed
        }
        async fn verify_sign_up(
            &self,
            _: &str,
            _: Option<&str>,
            _: &str,
        ) -> VerifySignUpProviderResult {
            self.verify_sign_up
                .lock()
                .unwrap()
                .take()
                .expect("verify_sign_up result")
        }
        async fn verify_sign_in(
            &self,
            _: &str,
            _: &str,
            _: &str,
        ) -> VerifySignInProviderResult {
            unreachable!()
        }
        async fn sign_out(&self, _: &str) -> SignOutProviderResult {
            self.sign_out.lock().unwrap().clone()
        }
    }

    struct FakeOwners {
        owner: Mutex<Owner>,
    }

    impl FakeOwners {
        fn new() -> Self {
            Self {
                owner: Mutex::new(Owner {
                    owner_id: "11111111-1111-1111-1111-111111111111".into(),
                    display_name: None,
                    avatar_url: None,
                    created_at: jiff::Timestamp::from_second(1_700_000_000).unwrap(),
                    updated_at: jiff::Timestamp::from_second(1_700_000_000).unwrap(),
                }),
            }
        }
    }

    #[async_trait::async_trait]
    impl OwnerRepository for FakeOwners {
        async fn resolve_by_cognito_subject(&self, _: &str) -> Owner {
            self.owner.lock().unwrap().clone()
        }
        async fn update_display_name(&self, _: &str, display_name: &str) -> Owner {
            let mut owner = self.owner.lock().unwrap();
            owner.display_name = Some(display_name.to_string());
            owner.clone()
        }
    }

    struct FakeVerifier {
        ok: bool,
    }

    #[async_trait::async_trait]
    impl AccessTokenVerifier for FakeVerifier {
        async fn verify(&self, _: &str) -> Result<Principal, ()> {
            if self.ok {
                Ok(Principal {
                    cognito_subject: "sub-1".into(),
                })
            } else {
                Err(())
            }
        }
    }

    struct FakeDogs {
        dogs: Mutex<Vec<Dog>>,
        duplicate_on_create: Mutex<bool>,
    }

    impl FakeDogs {
        fn new() -> Self {
            Self {
                dogs: Mutex::new(vec![]),
                duplicate_on_create: Mutex::new(false),
            }
        }

        fn with_dog(dog: Dog) -> Self {
            Self {
                dogs: Mutex::new(vec![dog]),
                duplicate_on_create: Mutex::new(false),
            }
        }
    }

    fn sample_dog() -> Dog {
        Dog {
            dog_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70".into(),
            owner_id: "11111111-1111-1111-1111-111111111111".into(),
            name: "Mugi".into(),
            gender: Gender::Female,
            birthday: Birthday::Day {
                year: 2020,
                month: 4,
                day: 12,
            },
            avatar_url: None,
            created_at: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
            updated_at: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
            current_goal: CurrentGoal {
                goal_revision_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e71".into(),
                period: GoalPeriodLiteral::Daily,
                minutes: 30,
                effective_from: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
                effective_to: None,
            },
        }
    }

    #[async_trait::async_trait]
    impl DogRepository for FakeDogs {
        async fn list_by_owner(&self, owner_id: &str) -> Vec<Dog> {
            self.dogs
                .lock()
                .unwrap()
                .iter()
                .filter(|d| d.owner_id == owner_id)
                .cloned()
                .collect()
        }
        async fn create_with_daily_goal(
            &self,
            owner_id: &str,
            input: &CreateDogInput,
        ) -> Result<Dog, DogNameDuplicateError> {
            if *self.duplicate_on_create.lock().unwrap() {
                return Err(DogNameDuplicateError);
            }
            let dog = Dog {
                dog_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70".into(),
                owner_id: owner_id.to_string(),
                name: input.name.clone(),
                gender: input.gender,
                birthday: input.birthday.clone(),
                avatar_url: None,
                created_at: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
                updated_at: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
                current_goal: CurrentGoal {
                    goal_revision_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e71".into(),
                    period: GoalPeriodLiteral::Daily,
                    minutes: 30,
                    effective_from: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
                    effective_to: None,
                },
            };
            self.dogs.lock().unwrap().push(dog.clone());
            Ok(dog)
        }
        async fn get_by_owner_and_id(&self, owner_id: &str, dog_id: &str) -> Option<Dog> {
            self.dogs
                .lock()
                .unwrap()
                .iter()
                .find(|d| d.owner_id == owner_id && d.dog_id == dog_id)
                .cloned()
        }
    }

    struct FakeWalks {
        active: Mutex<Option<RecordingWalk>>,
        start_result: Mutex<Result<RecordingWalk, StartWalkError>>,
        fail_result: Mutex<Result<(), FailWalkError>>,
        accept_result: Mutex<Result<TrackPoint, AcceptTrackPointError>>,
        record_event_result: Mutex<Result<RecordedEvent, RecordEventError>>,
        finish_result: Mutex<Result<CompletedWalk, FinishWalkError>>,
        detail_result: Mutex<Result<CompletedWalk, WalkNotFoundError>>,
        accepted: Mutex<Result<Vec<TrackPoint>, ListAcceptedError>>,
        events: Mutex<Vec<WalkEvent>>,
    }

    impl FakeWalks {
        fn new() -> Self {
            Self {
                active: Mutex::new(None),
                start_result: Mutex::new(Err(StartWalkError::NotFound(WalkNotFoundError))),
                fail_result: Mutex::new(Ok(())),
                accept_result: Mutex::new(Err(AcceptTrackPointError::NotFound(WalkNotFoundError))),
                record_event_result: Mutex::new(Err(RecordEventError::NotFound(WalkNotFoundError))),
                finish_result: Mutex::new(Err(FinishWalkError::NotFound(WalkNotFoundError))),
                detail_result: Mutex::new(Err(WalkNotFoundError)),
                accepted: Mutex::new(Ok(vec![])),
                events: Mutex::new(vec![]),
            }
        }

        fn with_active(walk: RecordingWalk) -> Self {
            Self {
                active: Mutex::new(Some(walk.clone())),
                start_result: Mutex::new(Ok(walk)),
                fail_result: Mutex::new(Ok(())),
                accept_result: Mutex::new(Err(AcceptTrackPointError::NotFound(WalkNotFoundError))),
                record_event_result: Mutex::new(Err(RecordEventError::NotFound(WalkNotFoundError))),
                finish_result: Mutex::new(Err(FinishWalkError::NotFound(WalkNotFoundError))),
                detail_result: Mutex::new(Err(WalkNotFoundError)),
                accepted: Mutex::new(Ok(vec![])),
                events: Mutex::new(vec![]),
            }
        }
    }

    fn sample_walk() -> RecordingWalk {
        RecordingWalk {
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            owner_id: "11111111-1111-1111-1111-111111111111".into(),
            started_at: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
            participants: vec![WalkParticipant {
                walk_participant_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e81".into(),
                dog_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70".into(),
                name: "Mugi".into(),
            }],
        }
    }

    fn sample_completed() -> CompletedWalk {
        CompletedWalk {
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            owner_id: "11111111-1111-1111-1111-111111111111".into(),
            started_at: jiff::Timestamp::from_second(1_723_636_811).unwrap(),
            completed_at: jiff::Timestamp::from_second(1_723_637_411).unwrap(),
            duration_seconds: 600,
            distance_meters: 0,
            pace_seconds_per_meter: None,
            participants: sample_walk().participants,
        }
    }

    fn sample_track_point() -> TrackPoint {
        TrackPoint {
            track_point_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90".into(),
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            recorded_at: "2026-08-17T12:00:00Z".parse().unwrap(),
            latitude: 35.681_236,
            longitude: 139.767_125,
        }
    }

    fn sample_event() -> WalkEvent {
        WalkEvent {
            event_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90".into(),
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            participant_dog_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70".into(),
            event_type: WalkEventType::Pee,
            occurred_at: "2026-09-06T03:20:11Z".parse().unwrap(),
            latitude: 35.681_236,
            longitude: 139.767_125,
        }
    }

    #[async_trait::async_trait]
    impl WalkRepository for FakeWalks {
        async fn get_active_by_owner(&self, _: &str) -> Option<RecordingWalk> {
            self.active.lock().unwrap().clone()
        }
        async fn get_completed_by_owner(
            &self,
            _: &str,
            _: &str,
        ) -> Result<CompletedWalk, WalkNotFoundError> {
            self.detail_result.lock().unwrap().clone()
        }
        async fn start(&self, _: &StartWalkInput) -> Result<RecordingWalk, StartWalkError> {
            self.start_result.lock().unwrap().clone()
        }
        async fn finish(&self, _: &FinishWalkInput) -> Result<CompletedWalk, FinishWalkError> {
            self.finish_result.lock().unwrap().clone()
        }
        async fn fail(&self, _: &str, _: &str) -> Result<(), FailWalkError> {
            self.fail_result.lock().unwrap().clone()
        }
        async fn fail_if_present(&self, _: &str) {}
        async fn accept_track_point(
            &self,
            _: &AcceptTrackPointInput,
        ) -> Result<TrackPoint, AcceptTrackPointError> {
            self.accept_result.lock().unwrap().clone()
        }
        async fn record_event(
            &self,
            _: &RecordEventInput,
        ) -> Result<RecordedEvent, RecordEventError> {
            self.record_event_result.lock().unwrap().clone()
        }
        async fn list_accepted_track_points(
            &self,
            _: &str,
            _: &str,
        ) -> Result<Vec<TrackPoint>, ListAcceptedError> {
            self.accepted.lock().unwrap().clone()
        }

        async fn list_events(&self, _: &str) -> Vec<WalkEvent> {
            self.events.lock().unwrap().clone()
        }
    }

    #[async_trait::async_trait]
    impl ActiveWalkCommands for FakeWalks {
        async fn fail_if_present(&self, _: &str) {}
    }

    struct FakeQueue {
        fail: Mutex<bool>,
    }

    #[async_trait::async_trait]
    impl TrackPointQueue for FakeQueue {
        async fn enqueue(&self, _: &TrackPoint) -> Result<(), ()> {
            if *self.fail.lock().unwrap() {
                Err(())
            } else {
                Ok(())
            }
        }
    }

    struct FakeConfirm {
        fail: Mutex<bool>,
    }

    #[async_trait::async_trait]
    impl ConfirmTrackPoint for FakeConfirm {
        async fn confirm(&self, _: &TrackPoint) -> Result<(), ()> {
            if *self.fail.lock().unwrap() {
                Err(())
            } else {
                Ok(())
            }
        }
    }

    struct FakeConfirmed {
        points: Mutex<Vec<ConfirmedTrackPoint>>,
    }

    #[async_trait::async_trait]
    impl ConfirmedTrackPoints for FakeConfirmed {
        async fn list_points(&self, _: &str) -> Result<Vec<ConfirmedTrackPoint>, ()> {
            Ok(self.points.lock().unwrap().clone())
        }
        async fn list_recorded_at(&self, _: &str) -> Result<Vec<jiff::Timestamp>, ()> {
            Ok(self
                .points
                .lock()
                .unwrap()
                .iter()
                .map(|point| point.recorded_at)
                .collect())
        }
    }

    fn state_with(
        pings: Arc<dyn HealthPings>,
        auth: FakeAuth,
        verifier_ok: bool,
    ) -> AppState {
        let walks = Arc::new(FakeWalks::new());
        AppState {
            pings,
            auth_provider: Arc::new(auth),
            owner_repository: Arc::new(FakeOwners::new()),
            dog_repository: Arc::new(FakeDogs::new()),
            walk_repository: walks.clone(),
            access_token_verifier: Arc::new(FakeVerifier { ok: verifier_ok }),
            active_walk_commands: walks,
            track_point_queue: Arc::new(FakeQueue {
                fail: Mutex::new(false),
            }),
            confirmed_track_points: Arc::new(FakeConfirmed {
                points: Mutex::new(vec![]),
            }),
            confirm_track_point: Arc::new(FakeConfirm {
                fail: Mutex::new(false),
            }),
        }
    }

    fn state_with_dogs(dogs: FakeDogs, verifier_ok: bool) -> AppState {
        let walks = Arc::new(FakeWalks::new());
        AppState {
            pings: Arc::new(OkPings),
            auth_provider: Arc::new(FakeAuth::default()),
            owner_repository: Arc::new(FakeOwners::new()),
            dog_repository: Arc::new(dogs),
            walk_repository: walks.clone(),
            access_token_verifier: Arc::new(FakeVerifier { ok: verifier_ok }),
            active_walk_commands: walks,
            track_point_queue: Arc::new(FakeQueue {
                fail: Mutex::new(false),
            }),
            confirmed_track_points: Arc::new(FakeConfirmed {
                points: Mutex::new(vec![]),
            }),
            confirm_track_point: Arc::new(FakeConfirm {
                fail: Mutex::new(false),
            }),
        }
    }

    fn state_with_walks(walks: FakeWalks, verifier_ok: bool) -> AppState {
        state_with_walks_and_queue(
            walks,
            FakeQueue {
                fail: Mutex::new(false),
            },
            FakeConfirmed {
                points: Mutex::new(vec![]),
            },
            FakeConfirm {
                fail: Mutex::new(false),
            },
            verifier_ok,
        )
    }

    fn state_with_walks_and_queue(
        walks: FakeWalks,
        queue: FakeQueue,
        confirmed: FakeConfirmed,
        confirm: FakeConfirm,
        verifier_ok: bool,
    ) -> AppState {
        let walks = Arc::new(walks);
        AppState {
            pings: Arc::new(OkPings),
            auth_provider: Arc::new(FakeAuth::default()),
            owner_repository: Arc::new(FakeOwners::new()),
            dog_repository: Arc::new(FakeDogs::new()),
            walk_repository: walks.clone(),
            access_token_verifier: Arc::new(FakeVerifier { ok: verifier_ok }),
            active_walk_commands: walks,
            track_point_queue: Arc::new(queue),
            confirmed_track_points: Arc::new(confirmed),
            confirm_track_point: Arc::new(confirm),
        }
    }

    async fn json_body(response: axum::response::Response) -> serde_json::Value {
        let body = response.into_body().collect().await.unwrap().to_bytes();
        serde_json::from_slice(&body).unwrap()
    }

    #[tokio::test]
    async fn health_ok_returns_200_and_status() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header("x-request-id", "req-test-1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        assert_eq!(
            response.headers().get("x-request-id").unwrap(),
            "req-test-1"
        );
        let json = json_body(response).await;
        assert_eq!(json["status"], "ok");
    }

    #[tokio::test]
    async fn health_unavailable_returns_503_error_contract() {
        let app = create_app(state_with(Arc::new(DownPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .header("x-request-id", "req-test-2")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), 503);
        let json = json_body(response).await;
        assert_eq!(json["code"], "DEPENDENCY_UNAVAILABLE");
        assert_eq!(json["message"], "A required dependency is unavailable.");
        assert_eq!(json["requestId"], "req-test-2");
        assert_eq!(json["retryable"], true);
    }

    #[tokio::test]
    async fn sign_up_success() {
        let auth = FakeAuth {
            sign_up: Mutex::new(vec![SignUpProviderResult::SignedUp {
                session: Some("sess".into()),
                code_delivery: Some(CodeDelivery {
                    destination: "a@b.c".into(),
                    attribute: "email".into(),
                }),
            }]),
            ..FakeAuth::default()
        };
        let app = create_app(state_with(Arc::new(OkPings), auth, true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/auth/sign-up")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-su")
                    .body(Body::from(r#"{"email":"a@b.c"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let json = json_body(response).await;
        assert_eq!(json["username"], "a@b.c");
        assert_eq!(json["session"], "sess");
        assert_eq!(json["requestId"], "req-su");
    }

    #[tokio::test]
    async fn sign_up_username_exists_resends() {
        let auth = FakeAuth {
            sign_up: Mutex::new(vec![SignUpProviderResult::UsernameExists]),
            resend: Mutex::new(vec![ResendSignUpCodeProviderResult::CodeSent {
                code_delivery: Some(CodeDelivery {
                    destination: "a***@b.c".into(),
                    attribute: "email".into(),
                }),
            }]),
            ..FakeAuth::default()
        };
        let app = create_app(state_with(Arc::new(OkPings), auth, true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/auth/sign-up")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-resend")
                    .body(Body::from(r#"{"email":"a@b.c"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let json = json_body(response).await;
        assert!(json["session"].is_null());
        assert_eq!(json["codeDelivery"]["destination"], "a***@b.c");
    }

    #[tokio::test]
    async fn sign_up_verify_success_creates_owner_response() {
        let auth = FakeAuth {
            verify_sign_up: Mutex::new(Some(VerifySignUpProviderResult::Authenticated {
                authentication: Authentication {
                    subject: "sub-1".into(),
                    access_token: "at".into(),
                    id_token: "it".into(),
                    refresh_token: "rt".into(),
                },
            })),
            ..FakeAuth::default()
        };
        let app = create_app(state_with(Arc::new(OkPings), auth, true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/auth/sign-up/verify")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-verify")
                    .body(Body::from(
                        r#"{"username":"a@b.c","session":"sess","code":"123456"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let json = json_body(response).await;
        assert_eq!(json["accessToken"], "at");
        assert_eq!(json["owner"]["ownerId"], "11111111-1111-1111-1111-111111111111");
        assert!(json["owner"]["avatarUrl"].is_null());
    }

    #[tokio::test]
    async fn sign_out_returns_204() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/auth/sign-out")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-out")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 204);
    }

    #[tokio::test]
    async fn unauthenticated_returns_401() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/owner")
                    .header("x-request-id", "req-401")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 401);
        let json = json_body(response).await;
        assert_eq!(json["code"], "UNAUTHENTICATED");
        assert_eq!(json["message"], "Authentication is required.");
        assert_eq!(json["requestId"], "req-401");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn owner_get_and_patch_success() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));

        let get_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/owner")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-get")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(get_response.status(), 200);
        let get_json = json_body(get_response).await;
        assert_eq!(
            get_json["ownerId"],
            "11111111-1111-1111-1111-111111111111"
        );

        let patch_response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/owner")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-patch")
                    .body(Body::from(r#"{"displayName":"Nova"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(patch_response.status(), 200);
        let patch_json = json_body(patch_response).await;
        assert_eq!(patch_json["displayName"], "Nova");
    }

    #[tokio::test]
    async fn owner_patch_display_name_validation_400() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/v1/owner")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-bad")
                    .body(Body::from(r#"{"displayName":""}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 400);
        let json = json_body(response).await;
        assert_eq!(json["code"], "INVALID_INPUT");
        assert_eq!(json["message"], "入力内容を確認してください。");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn openapi_lists_auth_owner_dogs_and_walks_paths() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/openapi.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let json = json_body(response).await;
        assert_eq!(json["info"]["title"], "walk / dog API");
        assert_eq!(json["info"]["version"], "0.1.0");
        assert!(json["paths"]["/v1/auth/sign-up"].is_object());
        assert!(json["paths"]["/v1/owner"].is_object());
        assert!(json["paths"]["/v1/dogs"].is_object());
        assert!(json["paths"]["/v1/dogs/{dogId}"].is_object());
        assert!(json["paths"]["/v1/walks/active"].is_object());
        assert!(json["paths"]["/v1/walks"].is_object());
        assert!(json["paths"]["/v1/walks/{walkId}"].is_object());
        assert!(json["paths"]["/v1/walks/{walkId}/finish"].is_object());
        assert!(json["paths"]["/v1/walks/{walkId}/track-points"].is_object());
        assert!(json["paths"]["/v1/walks/{walkId}/events"].is_object());
    }

    #[tokio::test]
    async fn dogs_list_create_get_and_errors() {
        let dogs = FakeDogs::with_dog(sample_dog());
        let app = create_app(state_with_dogs(dogs, true));

        let list = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dogs")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-list")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(list.status(), 200);
        let list_json = json_body(list).await;
        assert_eq!(list_json["requestId"], "req-list");
        assert_eq!(list_json["dogs"][0]["name"], "Mugi");
        assert_eq!(list_json["dogs"][0]["currentGoal"]["minutes"], 30);
        assert!(list_json["dogs"][0]["requestId"].is_null());

        let get = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dogs/0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-get-dog")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(get.status(), 200);
        let get_json = json_body(get).await;
        assert_eq!(get_json["dogId"], "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70");
        assert_eq!(get_json["requestId"], "req-get-dog");

        let missing = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dogs/0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e99")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-404")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), 404);
        let missing_json = json_body(missing).await;
        assert_eq!(missing_json["code"], "NOT_FOUND");
        assert_eq!(
            missing_json["message"],
            "The requested resource was not found."
        );

        let bad_id = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dogs/not-a-uuid")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-bad-id")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad_id.status(), 404);

        let create = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dogs")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-create")
                    .body(Body::from(
                        r#"{"name":"  Pochi  ","gender":"male","birthday":{"precision":"year","year":2019}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(create.status(), 201);
        let create_json = json_body(create).await;
        assert_eq!(create_json["name"], "Pochi");
        assert_eq!(create_json["gender"], "male");
        assert_eq!(create_json["birthday"]["precision"], "year");
        assert_eq!(create_json["currentGoal"]["period"], "daily");
        assert_eq!(create_json["currentGoal"]["minutes"], 30);
        assert!(create_json["currentGoal"]["effectiveTo"].is_null());
        assert!(create_json["avatarUrl"].is_null());

        let invalid = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dogs")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-bad-body")
                    .body(Body::from(r#"{"name":"","gender":"male"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(invalid.status(), 400);
        let invalid_json = json_body(invalid).await;
        assert_eq!(invalid_json["code"], "INVALID_INPUT");

        let bad_birthday = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dogs")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-bad-bday")
                    .body(Body::from(
                        r#"{"name":"X","gender":"male","birthday":{"precision":"month","year":2020,"month":13}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad_birthday.status(), 400);
    }

    #[tokio::test]
    async fn dogs_create_duplicate_returns_409_japanese_message() {
        let dogs = FakeDogs::new();
        *dogs.duplicate_on_create.lock().unwrap() = true;
        let app = create_app(state_with_dogs(dogs, true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/dogs")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-dup")
                    .body(Body::from(r#"{"name":"Mugi","gender":"female"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 409);
        let json = json_body(response).await;
        assert_eq!(json["code"], "DOG_NAME_DUPLICATE");
        assert_eq!(json["message"], "同じ名前のDogが既に存在します。");
        assert_eq!(json["requestId"], "req-dup");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn dogs_unauthenticated_returns_401() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/dogs")
                    .header("x-request-id", "req-dogs-401")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 401);
        let json = json_body(response).await;
        assert_eq!(json["code"], "UNAUTHENTICATED");
    }

    #[tokio::test]
    async fn walks_active_start_delete_and_errors() {
        let walks = FakeWalks::with_active(sample_walk());
        let app = create_app(state_with_walks(walks, true));

        let active = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/walks/active")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-active")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(active.status(), 200);
        let active_json = json_body(active).await;
        assert_eq!(active_json["requestId"], "req-active");
        assert_eq!(active_json["walkId"], "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80");
        assert_eq!(active_json["state"], "recording");
        assert!(active_json["completedAt"].is_null());
        assert_eq!(active_json["participants"][0]["name"], "Mugi");

        let create = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-1")
                    .header("x-request-id", "req-start")
                    .body(Body::from(
                        r#"{"participantDogIds":["0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70"]}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(create.status(), 201);
        let create_json = json_body(create).await;
        assert_eq!(create_json["requestId"], "req-start");
        assert_eq!(create_json["state"], "recording");

        let delete = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/v1/walks/0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-del")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(delete.status(), 204);

        let bad_id = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/v1/walks/not-a-uuid")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-bad-walk")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad_id.status(), 404);
    }

    #[tokio::test]
    async fn walks_active_returns_204_when_none() {
        let app = create_app(state_with_walks(FakeWalks::new(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/walks/active")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-none")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 204);
    }

    #[tokio::test]
    async fn walks_start_conflict_and_validation() {
        let walks = FakeWalks::new();
        *walks.start_result.lock().unwrap() =
            Err(StartWalkError::ActiveWalkExists(ActiveWalkExistsError));
        let app = create_app(state_with_walks(walks, true));

        let conflict = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-1")
                    .header("x-request-id", "req-active-exists")
                    .body(Body::from(
                        r#"{"participantDogIds":["0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70"]}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(conflict.status(), 409);
        let conflict_json = json_body(conflict).await;
        assert_eq!(conflict_json["code"], "ACTIVE_WALK_EXISTS");
        assert_eq!(conflict_json["message"], "すでに記録中の散歩があります。");

        let missing_key = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-no-key")
                    .body(Body::from(
                        r#"{"participantDogIds":["0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70"]}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing_key.status(), 400);

        let empty_ids = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-2")
                    .header("x-request-id", "req-empty")
                    .body(Body::from(r#"{"participantDogIds":[]}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(empty_ids.status(), 400);
    }

    #[tokio::test]
    async fn walks_start_idempotency_conflict_and_not_found() {
        let walks = FakeWalks::new();
        *walks.start_result.lock().unwrap() =
            Err(StartWalkError::IdempotencyConflict(IdempotencyConflictError));
        let app = create_app(state_with_walks(walks, true));
        let conflict = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-1")
                    .header("x-request-id", "req-idem")
                    .body(Body::from(
                        r#"{"participantDogIds":["0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70"]}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(conflict.status(), 409);
        let json = json_body(conflict).await;
        assert_eq!(json["code"], "IDEMPOTENCY_CONFLICT");

        let walks = FakeWalks::new();
        *walks.start_result.lock().unwrap() =
            Err(StartWalkError::NotFound(WalkNotFoundError));
        let app = create_app(state_with_walks(walks, true));
        let missing = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-1")
                    .header("x-request-id", "req-nf")
                    .body(Body::from(
                        r#"{"participantDogIds":["0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70"]}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), 404);
        let missing_json = json_body(missing).await;
        assert_eq!(missing_json["code"], "NOT_FOUND");
    }

    #[tokio::test]
    async fn walks_delete_not_recording_returns_409() {
        let walks = FakeWalks::new();
        *walks.fail_result.lock().unwrap() =
            Err(FailWalkError::NotRecording(WalkNotRecordingError));
        let app = create_app(state_with_walks(walks, true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/v1/walks/0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-nr")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 409);
        let json = json_body(response).await;
        assert_eq!(json["code"], "WALK_NOT_RECORDING");
        assert_eq!(json["message"], "この散歩は破棄できません。");
    }

    #[tokio::test]
    async fn walks_unauthenticated_returns_401() {
        let app = create_app(state_with(Arc::new(OkPings), FakeAuth::default(), true));
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/walks/active")
                    .header("x-request-id", "req-walks-401")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 401);
        let json = json_body(response).await;
        assert_eq!(json["code"], "UNAUTHENTICATED");
    }

    #[tokio::test]
    async fn walks_track_points_success_and_errors() {
        let walks = FakeWalks::new();
        *walks.accept_result.lock().unwrap() = Ok(sample_track_point());
        let app = create_app(state_with_walks(walks, true));
        let walk_id = "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80";
        let body = r#"{"recordedAt":"2026-08-17T12:00:00Z","latitude":35.681236,"longitude":139.767125}"#;

        let ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/track-points"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-tp")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(ok.status(), 201);
        let ok_json = json_body(ok).await;
        assert_eq!(ok_json["requestId"], "req-tp");
        assert_eq!(ok_json["trackPointId"], "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90");
        assert_eq!(ok_json["latitude"], 35.681236);

        let walks = FakeWalks::new();
        *walks.accept_result.lock().unwrap() =
            Err(AcceptTrackPointError::NotFound(WalkNotFoundError));
        let app = create_app(state_with_walks(walks, true));
        let missing = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/track-points"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-tp-404")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), 404);
        let missing_json = json_body(missing).await;
        assert_eq!(missing_json["code"], "NOT_FOUND");
        assert_eq!(missing_json["message"], "Walk が見つかりません。");

        let walks = FakeWalks::new();
        *walks.accept_result.lock().unwrap() =
            Err(AcceptTrackPointError::NotRecording(WalkNotRecordingError));
        let app = create_app(state_with_walks(walks, true));
        let not_recording = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/track-points"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-tp-nr")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(not_recording.status(), 409);
        let nr_json = json_body(not_recording).await;
        assert_eq!(nr_json["code"], "WALK_NOT_RECORDING");
        assert_eq!(nr_json["message"], "この Walk は記録中ではありません。");

        let walks = FakeWalks::new();
        *walks.accept_result.lock().unwrap() = Err(AcceptTrackPointError::IdempotencyConflict(
            IdempotencyConflictError,
        ));
        let app = create_app(state_with_walks(walks, true));
        let conflict = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/track-points"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-tp-idem")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(conflict.status(), 409);
        let conflict_json = json_body(conflict).await;
        assert_eq!(conflict_json["code"], "IDEMPOTENCY_CONFLICT");

        let walks = FakeWalks::new();
        *walks.accept_result.lock().unwrap() = Ok(sample_track_point());
        let app = create_app(state_with_walks_and_queue(
            walks,
            FakeQueue {
                fail: Mutex::new(true),
            },
            FakeConfirmed {
                points: Mutex::new(vec![]),
            },
            FakeConfirm {
                fail: Mutex::new(false),
            },
            true,
        ));
        let enqueue_fail = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/track-points"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-tp-500")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(enqueue_fail.status(), 500);
        let fail_json = json_body(enqueue_fail).await;
        assert_eq!(fail_json["code"], "INTERNAL_ERROR");
        assert_eq!(fail_json["retryable"], true);
    }

    #[tokio::test]
    async fn walks_finish_success_and_service_unavailable() {
        let walks = FakeWalks::new();
        *walks.finish_result.lock().unwrap() = Ok(sample_completed());
        let app = create_app(state_with_walks(walks, true));
        let walk_id = "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80";

        let ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/finish"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-finish")
                    .header("x-request-id", "req-finish")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(ok.status(), 200);
        let ok_json = json_body(ok).await;
        assert_eq!(ok_json["state"], "completed");
        assert_eq!(ok_json["requestId"], "req-finish");

        let walks = FakeWalks::new();
        *walks.accepted.lock().unwrap() = Ok(vec![TrackPoint {
            track_point_id: "tp-1".into(),
            walk_id: walk_id.to_string(),
            recorded_at: "2026-08-17T12:00:00Z".parse().unwrap(),
            latitude: 35.681_236,
            longitude: 139.767_125,
        }]);
        *walks.finish_result.lock().unwrap() = Ok(sample_completed());
        let app = create_app(state_with_walks_and_queue(
            walks,
            FakeQueue {
                fail: Mutex::new(false),
            },
            FakeConfirmed {
                points: Mutex::new(vec![]),
            },
            FakeConfirm {
                fail: Mutex::new(true),
            },
            true,
        ));
        let unavailable = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/finish"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-finish-2")
                    .header("x-request-id", "req-503")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unavailable.status(), 503);
        let unavailable_json = json_body(unavailable).await;
        assert_eq!(unavailable_json["code"], "SERVICE_UNAVAILABLE");
        assert_eq!(unavailable_json["retryable"], true);

        let walks = FakeWalks::new();
        *walks.finish_result.lock().unwrap() =
            Err(FinishWalkError::NotRecording(WalkNotRecordingError));
        let app = create_app(state_with_walks(walks, true));
        let not_recording = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/finish"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("idempotency-key", "idem-finish-3")
                    .header("x-request-id", "req-finish-nr")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(not_recording.status(), 409);
        let nr_json = json_body(not_recording).await;
        assert_eq!(nr_json["code"], "WALK_NOT_RECORDING");
        assert_eq!(nr_json["message"], "この散歩は終了できません。");
    }

    #[tokio::test]
    async fn walks_detail_success_and_not_found() {
        let walks = FakeWalks::new();
        *walks.detail_result.lock().unwrap() = Ok(sample_completed());
        let recorded_at: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        let app = create_app(state_with_walks_and_queue(
            walks,
            FakeQueue {
                fail: Mutex::new(false),
            },
            FakeConfirmed {
                points: Mutex::new(vec![ConfirmedTrackPoint {
                    recorded_at,
                    latitude: 35.681_236,
                    longitude: 139.767_125,
                }]),
            },
            FakeConfirm {
                fail: Mutex::new(false),
            },
            true,
        ));
        let walk_id = "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80";
        let ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/v1/walks/{walk_id}"))
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-detail")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(ok.status(), 200);
        let ok_json = json_body(ok).await;
        assert_eq!(ok_json["state"], "completed");
        assert_eq!(ok_json["trackPoints"][0]["latitude"], 35.681236);
        assert!(ok_json["events"].is_array());

        let walks = FakeWalks::new();
        *walks.detail_result.lock().unwrap() = Err(WalkNotFoundError);
        let app = create_app(state_with_walks(walks, true));
        let missing = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/walks/0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e99")
                    .header("authorization", "Bearer good-token")
                    .header("x-request-id", "req-detail-404")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), 404);
    }

    #[tokio::test]
    async fn walks_events_success_and_errors() {
        let event = sample_event();
        let walks = FakeWalks::new();
        *walks.record_event_result.lock().unwrap() = Ok(RecordedEvent {
            event: event.clone(),
            created: true,
        });
        let app = create_app(state_with_walks(walks, true));
        let walk_id = "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80";
        let body = r#"{"eventId":"0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90","participantDogId":"0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70","type":"pee","occurredAt":"2026-09-06T03:20:11Z","latitude":35.681236,"longitude":139.767125}"#;

        let created = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/events"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(created.status(), 201);
        let created_json = json_body(created).await;
        assert_eq!(created_json["requestId"], "req-event");
        assert_eq!(created_json["eventId"], event.event_id);
        assert_eq!(created_json["type"], "pee");
        assert_eq!(created_json["latitude"], 35.681236);

        let walks = FakeWalks::new();
        *walks.record_event_result.lock().unwrap() = Ok(RecordedEvent {
            event: event.clone(),
            created: false,
        });
        let app = create_app(state_with_walks(walks, true));
        let replay = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/events"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event-replay")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(replay.status(), 200);

        let walks = FakeWalks::new();
        *walks.record_event_result.lock().unwrap() =
            Err(RecordEventError::NotFound(WalkNotFoundError));
        let app = create_app(state_with_walks(walks, true));
        let missing = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/events"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event-404")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(missing.status(), 404);
        let missing_json = json_body(missing).await;
        assert_eq!(missing_json["code"], "NOT_FOUND");
        assert_eq!(missing_json["message"], "Walk が見つかりません。");

        let walks = FakeWalks::new();
        let app = create_app(state_with_walks(walks, true));
        let bad_id = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/walks/not-a-uuid/events")
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event-bad-id")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad_id.status(), 404);
        let bad_id_json = json_body(bad_id).await;
        assert_eq!(bad_id_json["message"], "Walk が見つかりません。");

        let walks = FakeWalks::new();
        *walks.record_event_result.lock().unwrap() =
            Err(RecordEventError::NotRecording(WalkNotRecordingError));
        let app = create_app(state_with_walks(walks, true));
        let not_recording = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/events"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event-nr")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(not_recording.status(), 409);
        let nr_json = json_body(not_recording).await;
        assert_eq!(nr_json["code"], "WALK_NOT_RECORDING");
        assert_eq!(nr_json["message"], "この散歩には記録できません。");

        let walks = FakeWalks::new();
        *walks.record_event_result.lock().unwrap() = Err(RecordEventError::IdempotencyConflict(
            IdempotencyConflictError,
        ));
        let app = create_app(state_with_walks(walks, true));
        let conflict = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/events"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event-idem")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(conflict.status(), 409);
        let conflict_json = json_body(conflict).await;
        assert_eq!(conflict_json["code"], "IDEMPOTENCY_CONFLICT");
        assert_eq!(
            conflict_json["message"],
            "同じ要求を完了できません。最初からやり直してください。"
        );

        let walks = FakeWalks::new();
        *walks.record_event_result.lock().unwrap() = Ok(RecordedEvent {
            event,
            created: true,
        });
        let app = create_app(state_with_walks(walks, true));
        let invalid = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/v1/walks/{walk_id}/events"))
                    .header("authorization", "Bearer good-token")
                    .header("content-type", "application/json")
                    .header("x-request-id", "req-event-400")
                    .body(Body::from(r#"{"eventId":"0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90","participantDogId":"0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e70","type":"bark","occurredAt":"2026-09-06T03:20:11Z","latitude":35.681236,"longitude":139.767125}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(invalid.status(), 400);
        let invalid_json = json_body(invalid).await;
        assert_eq!(invalid_json["code"], "INVALID_INPUT");
    }
}
