use crate::app::AppState;
use crate::infrastructure::cognito::{CognitoAccessTokenVerifier, CognitoAuthProvider};
use crate::infrastructure::config::AppConfig;
use crate::infrastructure::database::{
    connect_toasty, DependencyPings, ToastyDogRepository, ToastyOwnerRepository,
    ToastyWalkRepository,
};
use crate::infrastructure::dynamodb::{
    create_dynamodb_client, DynamoConfirmTrackPoint, DynamoConfirmedTrackPoints,
};
use crate::infrastructure::observability::init_tracing;
use crate::infrastructure::sqs::{create_sqs_client, SqsTrackPointQueue};
use std::sync::Arc;

pub struct Application {
    pub state: AppState,
    pub listen_addr: String,
}

pub async fn create_application(config: AppConfig) -> Result<Application, String> {
    init_tracing(&config.environment, &config.release);

    let database_url = config.postgres.connection_url();
    let db = connect_toasty(&config.postgres).await?;
    let pings = DependencyPings::new(db.clone(), database_url, config.worker_health_url.clone());

    let auth_provider = CognitoAuthProvider::from_config(&config.cognito).await;
    let owner_repository = ToastyOwnerRepository::new(db.clone());
    let dog_repository = ToastyDogRepository::new(db.clone());
    let walk_repository = Arc::new(ToastyWalkRepository::new(db));
    let access_token_verifier = CognitoAccessTokenVerifier::from_config(&config.cognito);

    let sqs_client = create_sqs_client(&config.sqs).await;
    let track_point_queue = SqsTrackPointQueue::new(sqs_client, &config.sqs);
    let dynamo_client = create_dynamodb_client(&config.dynamodb).await;
    let confirm_track_point = DynamoConfirmTrackPoint::new(dynamo_client.clone(), &config.dynamodb);
    let confirmed_track_points = DynamoConfirmedTrackPoints::new(dynamo_client, &config.dynamodb);

    Ok(Application {
        state: AppState {
            pings: Arc::new(pings),
            auth_provider: Arc::new(auth_provider),
            owner_repository: Arc::new(owner_repository),
            dog_repository: Arc::new(dog_repository),
            walk_repository: walk_repository.clone(),
            access_token_verifier: Arc::new(access_token_verifier),
            active_walk_commands: walk_repository,
            track_point_queue: Arc::new(track_point_queue),
            confirmed_track_points: Arc::new(confirmed_track_points),
            confirm_track_point: Arc::new(confirm_track_point),
        },
        listen_addr: config.listen_addr,
    })
}
