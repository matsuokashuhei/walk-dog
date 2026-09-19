use crate::app::AppState;
use crate::infrastructure::config::AppConfig;
use crate::infrastructure::database::{connect_toasty, DependencyPings};
use crate::infrastructure::observability::init_tracing;
use std::sync::Arc;

pub struct Application {
    pub state: AppState,
    pub listen_addr: String,
}

pub async fn create_application(config: AppConfig) -> Result<Application, String> {
    init_tracing(&config.environment, &config.release);

    let database_url = config.postgres.connection_url();
    let db = connect_toasty(&config.postgres).await?;
    let pings = DependencyPings::new(db, database_url, config.worker_health_url.clone());

    Ok(Application {
        state: AppState {
            pings: Arc::new(pings),
        },
        listen_addr: config.listen_addr,
    })
}
