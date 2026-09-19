use crate::app::AppState;
use crate::infrastructure::cognito::{CognitoAccessTokenVerifier, CognitoAuthProvider};
use crate::infrastructure::config::AppConfig;
use crate::infrastructure::database::{
    connect_toasty, DependencyPings, SqlActiveWalkCommands, ToastyDogRepository,
    ToastyOwnerRepository,
};
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
    let pings = DependencyPings::new(db.clone(), database_url.clone(), config.worker_health_url.clone());

    let auth_provider = CognitoAuthProvider::from_config(&config.cognito).await;
    let owner_repository = ToastyOwnerRepository::new(db.clone());
    let dog_repository = ToastyDogRepository::new(db);
    let access_token_verifier = CognitoAccessTokenVerifier::from_config(&config.cognito);
    let active_walk_commands = SqlActiveWalkCommands::new(database_url);

    Ok(Application {
        state: AppState {
            pings: Arc::new(pings),
            auth_provider: Arc::new(auth_provider),
            owner_repository: Arc::new(owner_repository),
            dog_repository: Arc::new(dog_repository),
            access_token_verifier: Arc::new(access_token_verifier),
            active_walk_commands: Arc::new(active_walk_commands),
        },
        listen_addr: config.listen_addr,
    })
}
