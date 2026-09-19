use api_rs::app::create_app;
use api_rs::composition::create_application;
use api_rs::infrastructure::config::AppConfig;

#[tokio::main]
async fn main() {
    let config = AppConfig::from_env().unwrap_or_else(|err| {
        eprintln!("config error: {err}");
        std::process::exit(1);
    });

    let application = create_application(config).await.unwrap_or_else(|err| {
        eprintln!("startup error: {err}");
        std::process::exit(1);
    });

    let listener = tokio::net::TcpListener::bind(&application.listen_addr)
        .await
        .unwrap_or_else(|err| {
            eprintln!("bind error: {err}");
            std::process::exit(1);
        });

    tracing::info!(addr = %application.listen_addr, "api listening");
    axum::serve(listener, create_app(application.state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap_or_else(|err| {
            eprintln!("server error: {err}");
            std::process::exit(1);
        });
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
