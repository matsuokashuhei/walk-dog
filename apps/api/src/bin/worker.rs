use api::infrastructure::config::{DynamoDbConfig, SqsConfig};
use api::infrastructure::dynamodb::{
    create_dynamodb_client, ensure_track_points_table, DynamoConfirmTrackPoint,
};
use api::infrastructure::observability::init_tracing;
use api::infrastructure::sqs::create_sqs_client;
use api::modules::walks::worker::{process_sqs_messages, ProcessSqsMessagesInput};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
}

#[tokio::main]
async fn main() {
    let environment = std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".into());
    let release = std::env::var("RELEASE").unwrap_or_else(|_| "worker".into());
    init_tracing(&environment, &release);

    let sqs_config = SqsConfig::from_env().unwrap_or_else(|err| {
        eprintln!("worker config error: {err}");
        std::process::exit(1);
    });
    let dynamo_config = DynamoDbConfig::from_env().unwrap_or_else(|err| {
        eprintln!("worker config error: {err}");
        std::process::exit(1);
    });

    let port: u16 = std::env::var("WORKER_HEALTH_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3001);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let sqs_client = create_sqs_client(&sqs_config).await;
    let dynamo_client = create_dynamodb_client(&dynamo_config).await;
    if let Err(err) = ensure_track_points_table(&dynamo_client, &dynamo_config).await {
        eprintln!("worker ensure table error: {err}");
        std::process::exit(1);
    }
    let confirm = DynamoConfirmTrackPoint::new(dynamo_client, &dynamo_config);

    let running = Arc::new(AtomicBool::new(true));
    let running_for_signal = running.clone();
    tokio::spawn(async move {
        shutdown_signal().await;
        running_for_signal.store(false, Ordering::SeqCst);
    });

    let health = Router::new().route(
        "/health",
        get(|| async { Json(HealthBody { status: "ok" }) }),
    );
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap_or_else(|err| {
        eprintln!("worker bind error: {err}");
        std::process::exit(1);
    });
    eprintln!("worker health listening on {addr}");

    let health_server = axum::serve(listener, health);
    let queue_url = sqs_config.queue_url.clone();
    let poll = async move {
        process_sqs_messages(ProcessSqsMessagesInput {
            sqs: &sqs_client,
            queue_url: &queue_url,
            confirm: &confirm,
            should_continue: &|| running.load(Ordering::SeqCst),
        })
        .await;
    };

    tokio::select! {
        result = health_server => {
            if let Err(err) = result {
                eprintln!("worker health error: {err}");
                std::process::exit(1);
            }
        }
        _ = poll => {}
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
