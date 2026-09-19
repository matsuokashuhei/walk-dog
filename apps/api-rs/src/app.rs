use std::sync::Arc;

use axum::http::{HeaderValue, Request, Response};
use axum::middleware::{self, Next};
use axum::routing::get;
use axum::Router;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;

use crate::modules::health::routes::health_handler;
use crate::modules::health::HealthPings;
use crate::shared::http::request_id::RequestId;

#[derive(Clone)]
pub struct AppState {
    pub pings: Arc<dyn HealthPings>,
}

pub fn create_app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(middleware::from_fn(attach_request_id_header)),
        )
        .with_state(state)
}

async fn attach_request_id_header(mut request: Request<axum::body::Body>, next: Next) -> Response<axum::body::Body> {
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
    use crate::modules::health::use_cases::check_health::BoxFut;
    use crate::modules::health::HealthPings;
    use axum::body::Body;
    use http_body_util::BodyExt;
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

    #[tokio::test]
    async fn health_ok_returns_200_and_status() {
        let app = create_app(AppState {
            pings: Arc::new(OkPings),
        });
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
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["status"], "ok");
    }

    #[tokio::test]
    async fn health_unavailable_returns_503_error_contract() {
        let app = create_app(AppState {
            pings: Arc::new(DownPings),
        });
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
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["code"], "DEPENDENCY_UNAVAILABLE");
        assert_eq!(json["message"], "A required dependency is unavailable.");
        assert_eq!(json["requestId"], "req-test-2");
        assert_eq!(json["retryable"], true);
    }
}
