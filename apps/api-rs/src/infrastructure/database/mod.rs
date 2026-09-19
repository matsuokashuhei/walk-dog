//! Toasty PostgreSQL connection and health pings.

use std::sync::Arc;

use toasty::Db;
use tokio::sync::Mutex;
use tokio_postgres::NoTls;

use crate::infrastructure::config::PostgresConfig;
use crate::infrastructure::database::dog_model::{DogRecord, GoalRevisionRecord};
use crate::infrastructure::database::owner_model::OwnerRecord;
use crate::infrastructure::database::walk_model::{
    WalkCommandKeyRecord, WalkEventRecord, WalkParticipantRecord, WalkRecord, WalkTrackPointRecord,
};
use crate::modules::health::use_cases::check_health::BoxFut;
use crate::modules::health::HealthPings;

/// Minimal model registered with Toasty so `Db::builder` can construct a handle.
/// Table name is namespaced so it does not collide with product Drizzle tables.
/// Schema is applied only when `ensure_probe_schema` is called (tests / explicit ops).
#[derive(Debug, toasty::Model)]
#[table = "_api_rs_schema_probe"]
pub struct SchemaProbe {
    #[key]
    #[auto]
    pub id: i64,
}

pub mod dog_model;
pub mod dog_repository;
pub mod owner_model;
pub mod owner_repository;
pub mod walk_model;
pub mod walk_repository;

pub use dog_repository::ToastyDogRepository;
pub use owner_repository::ToastyOwnerRepository;
pub use walk_repository::ToastyWalkRepository;

pub async fn connect_toasty(config: &PostgresConfig) -> Result<Arc<Mutex<Db>>, String> {
    let url = config.connection_url();
    let db = Db::builder()
        .models(toasty::models!(
            SchemaProbe,
            OwnerRecord,
            DogRecord,
            GoalRevisionRecord,
            WalkRecord,
            WalkParticipantRecord,
            WalkCommandKeyRecord,
            WalkTrackPointRecord,
            WalkEventRecord
        ))
        .max_pool_size(config.pool_max as usize)
        .connect(&url)
        .await
        .map_err(|e| format!("toasty connect failed: {e}"))?;
    Ok(Arc::new(Mutex::new(db)))
}

pub struct DependencyPings {
    database_url: String,
    worker_health_url: String,
    http: reqwest::Client,
    /// Held so composition always wires Toasty; repositories use this next.
    _db: Arc<Mutex<Db>>,
}

impl DependencyPings {
    pub fn new(db: Arc<Mutex<Db>>, database_url: String, worker_health_url: String) -> Self {
        Self {
            database_url,
            worker_health_url,
            http: reqwest::Client::new(),
            _db: db,
        }
    }
}

impl HealthPings for DependencyPings {
    fn ping_postgres(&self) -> BoxFut<'_> {
        let url = self.database_url.clone();
        Box::pin(async move {
            let (client, connection) = tokio_postgres::connect(&url, NoTls)
                .await
                .map_err(|_| ())?;
            tokio::spawn(async move {
                let _ = connection.await;
            });
            client.simple_query("SELECT 1").await.map_err(|_| ())?;
            Ok(())
        })
    }

    fn ping_worker(&self) -> BoxFut<'_> {
        let url = self.worker_health_url.clone();
        let http = self.http.clone();
        Box::pin(async move {
            let response = http.get(&url).send().await.map_err(|_| ())?;
            if response.status().is_success() {
                Ok(())
            } else {
                Err(())
            }
        })
    }
}
