use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use std::net::SocketAddr;

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
}

/// SQS worker stub — health only until Phase 4 ports confirm-track-point.
#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("WORKER_HEALTH_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3001);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let app = Router::new().route(
        "/health",
        get(|| async { Json(HealthBody { status: "ok" }) }),
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap_or_else(|err| {
        eprintln!("worker bind error: {err}");
        std::process::exit(1);
    });
    eprintln!("worker health listening on {addr}");
    axum::serve(listener, app).await.unwrap_or_else(|err| {
        eprintln!("worker error: {err}");
        std::process::exit(1);
    });
}
