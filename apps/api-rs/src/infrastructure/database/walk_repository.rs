//! Toasty WalkRepository — mirrors Drizzle `createDrizzleWalkRepository` (Phase 3a).

use std::collections::HashMap;
use std::sync::Arc;

use toasty::Db;
use tokio::sync::Mutex;

use crate::infrastructure::database::dog_model::DogRecord;
use crate::infrastructure::database::walk_model::{
    WalkCommandKeyRecord, WalkCommandNamespace, WalkParticipantRecord, WalkRecord, WalkState,
};
use crate::modules::walks::active_walk_commands::ActiveWalkCommands;
use crate::modules::walks::errors::{
    ActiveWalkExistsError, IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
};
use crate::modules::walks::repository::{FailWalkError, StartWalkError, WalkRepository};
use crate::modules::walks::types::{RecordingWalk, StartWalkInput, WalkParticipant};

const RECORDING_UNIQUE: &str = "walks_owner_id_recording_unique";
const COMMAND_KEY_UNIQUE: &str = "walk_command_keys_owner_id_namespace_key_unique";

pub struct ToastyWalkRepository {
    db: Arc<Mutex<Db>>,
}

impl ToastyWalkRepository {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }
}

fn to_participant(row: WalkParticipantRecord) -> WalkParticipant {
    WalkParticipant {
        walk_participant_id: row.walk_participant_id.to_string(),
        dog_id: row.dog_id.to_string(),
        name: row.name,
    }
}

fn to_recording_walk(walk: WalkRecord, participants: Vec<WalkParticipantRecord>) -> RecordingWalk {
    RecordingWalk {
        walk_id: walk.walk_id.to_string(),
        owner_id: walk.owner_id.to_string(),
        started_at: walk.started_at,
        participants: participants.into_iter().map(to_participant).collect(),
    }
}

fn error_message(error: &toasty::Error) -> String {
    error.to_string()
}

fn is_recording_unique(error: &toasty::Error) -> bool {
    error_message(error).contains(RECORDING_UNIQUE)
}

fn is_command_key_unique(error: &toasty::Error) -> bool {
    error_message(error).contains(COMMAND_KEY_UNIQUE)
}

async fn select_participants(db: &mut Db, walk_id: uuid::Uuid) -> Vec<WalkParticipantRecord> {
    let mut rows: Vec<WalkParticipantRecord> =
        WalkParticipantRecord::filter_by_walk_id(walk_id)
            .exec(db)
            .await
            .expect("list walk participants");
    rows.sort_by_key(|row| row.position);
    rows
}

async fn load_recording_walk(db: &mut Db, walk_id: uuid::Uuid) -> RecordingWalk {
    let walk = WalkRecord::get_by_walk_id(&mut *db, walk_id)
        .await
        .expect("load recording walk");
    let participants = select_participants(db, walk_id).await;
    to_recording_walk(walk, participants)
}

async fn resolve_start_command(
    db: &mut Db,
    owner_id: uuid::Uuid,
    key: &str,
    body_hash: &str,
) -> Result<Option<WalkCommandKeyRecord>, IdempotencyConflictError> {
    let rows: Vec<WalkCommandKeyRecord> = WalkCommandKeyRecord::filter(
        WalkCommandKeyRecord::fields()
            .owner_id()
            .eq(owner_id)
            .and(
                WalkCommandKeyRecord::fields()
                    .namespace()
                    .eq(WalkCommandNamespace::Start),
            )
            .and(WalkCommandKeyRecord::fields().key().eq(key)),
    )
    .exec(db)
    .await
    .expect("resolve start command key");
    let Some(existing) = rows.into_iter().next() else {
        return Ok(None);
    };
    if existing.body_hash != body_hash {
        return Err(IdempotencyConflictError);
    }
    Ok(Some(existing))
}

async fn select_dog_names(
    db: &mut Db,
    owner_id: uuid::Uuid,
    dog_ids: &[String],
) -> Result<Vec<String>, WalkNotFoundError> {
    let dogs: Vec<DogRecord> = DogRecord::filter_by_owner_id(owner_id)
        .exec(db)
        .await
        .expect("list dogs for walk start");
    let name_by_id: HashMap<String, String> = dogs
        .into_iter()
        .map(|dog| (dog.dog_id.to_string(), dog.name))
        .collect();
    dog_ids
        .iter()
        .map(|dog_id| {
            name_by_id
                .get(dog_id)
                .cloned()
                .ok_or(WalkNotFoundError)
        })
        .collect()
}

async fn start_walk_tx(
    db: &mut Db,
    input: &StartWalkInput,
) -> Result<RecordingWalk, StartWalkError> {
    let owner_uuid: uuid::Uuid = input.owner_id.parse().expect("owner_id uuid");
    if let Some(existing) =
        resolve_start_command(db, owner_uuid, &input.idempotency_key, &input.body_hash).await?
    {
        return Ok(load_recording_walk(db, existing.walk_id).await);
    }

    let names = select_dog_names(db, owner_uuid, &input.participant_dog_ids).await?;

    let mut tx = db
        .transaction()
        .await
        .expect("begin walk start transaction");

    let walk = match toasty::create!(WalkRecord {
        owner_id: owner_uuid,
        state: WalkState::Recording,
        started_at: jiff::Timestamp::now(),
        completed_at: None::<jiff::Timestamp>,
        distance_meters: None::<i32>,
    })
    .exec(&mut tx)
    .await
    {
        Ok(walk) => walk,
        Err(error) if is_recording_unique(&error) => {
            return Err(StartWalkError::ActiveWalkExists(ActiveWalkExistsError));
        }
        Err(error) => panic!("walk insert failed: {error}"),
    };

    let mut participants = Vec::with_capacity(input.participant_dog_ids.len());
    for (position, (dog_id, name)) in input
        .participant_dog_ids
        .iter()
        .zip(names)
        .enumerate()
    {
        let dog_uuid: uuid::Uuid = dog_id.parse().expect("dog_id uuid");
        let participant = toasty::create!(WalkParticipantRecord {
            walk_id: walk.walk_id,
            dog_id: dog_uuid,
            name: name,
            position: position as i32,
        })
        .exec(&mut tx)
        .await
        .expect("walk participant insert");
        participants.push(participant);
    }

    match toasty::create!(WalkCommandKeyRecord {
        owner_id: owner_uuid,
        namespace: WalkCommandNamespace::Start,
        key: input.idempotency_key.clone(),
        body_hash: input.body_hash.clone(),
        walk_id: walk.walk_id,
    })
    .exec(&mut tx)
    .await
    {
        Ok(_) => {}
        Err(error) if is_command_key_unique(&error) => {
            // Concurrent insert of the same key — recover outside the transaction.
            drop(tx);
            return replay_start(db, input).await;
        }
        Err(error) => panic!("walk command key insert failed: {error}"),
    }

    tx.commit().await.expect("commit walk start transaction");
    participants.sort_by_key(|row| row.position);
    Ok(to_recording_walk(walk, participants))
}

async fn replay_start(
    db: &mut Db,
    input: &StartWalkInput,
) -> Result<RecordingWalk, StartWalkError> {
    let owner_uuid: uuid::Uuid = input.owner_id.parse().expect("owner_id uuid");
    match resolve_start_command(db, owner_uuid, &input.idempotency_key, &input.body_hash).await? {
        Some(existing) => Ok(load_recording_walk(db, existing.walk_id).await),
        None => Err(StartWalkError::IdempotencyConflict(IdempotencyConflictError)),
    }
}

#[async_trait::async_trait]
impl WalkRepository for ToastyWalkRepository {
    async fn get_active_by_owner(&self, owner_id: &str) -> Option<RecordingWalk> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let mut db = self.db.lock().await;
        let walks: Vec<WalkRecord> = WalkRecord::filter(
            WalkRecord::fields()
                .owner_id()
                .eq(owner_uuid)
                .and(WalkRecord::fields().state().eq(WalkState::Recording)),
        )
        .exec(&mut *db)
        .await
        .expect("get active walk");
        let walk = walks.into_iter().next()?;
        let participants = select_participants(&mut db, walk.walk_id).await;
        Some(to_recording_walk(walk, participants))
    }

    async fn start(&self, input: &StartWalkInput) -> Result<RecordingWalk, StartWalkError> {
        let mut db = self.db.lock().await;
        start_walk_tx(&mut db, input).await
    }

    async fn fail(&self, owner_id: &str, walk_id: &str) -> Result<(), FailWalkError> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let walk_uuid: uuid::Uuid = walk_id.parse().expect("walk_id uuid");
        let mut db = self.db.lock().await;

        toasty::update!(
            WalkRecord::filter(
                WalkRecord::fields()
                    .walk_id()
                    .eq(walk_uuid)
                    .and(WalkRecord::fields().owner_id().eq(owner_uuid))
                    .and(WalkRecord::fields().state().eq(WalkState::Recording))
            ) {
                state: WalkState::Failed
            }
        )
        .exec(&mut *db)
        .await
        .expect("fail recording walk");

        let walk = match WalkRecord::get_by_walk_id(&mut *db, walk_uuid).await {
            Ok(walk) => walk,
            Err(error) if error.is_record_not_found() => {
                return Err(FailWalkError::NotFound(WalkNotFoundError));
            }
            Err(error) => panic!("get walk after fail: {error}"),
        };
        if walk.owner_id != owner_uuid {
            return Err(FailWalkError::NotFound(WalkNotFoundError));
        }
        match walk.state {
            WalkState::Failed => Ok(()),
            WalkState::Recording => {
                // Lost the race to another updater; treat as not recording for contract.
                Err(FailWalkError::NotRecording(WalkNotRecordingError))
            }
            WalkState::Completed => Err(FailWalkError::NotRecording(WalkNotRecordingError)),
        }
    }

    async fn fail_if_present(&self, owner_id: &str) {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let mut db = self.db.lock().await;
        toasty::update!(
            WalkRecord::filter(
                WalkRecord::fields()
                    .owner_id()
                    .eq(owner_uuid)
                    .and(WalkRecord::fields().state().eq(WalkState::Recording))
            ) {
                state: WalkState::Failed
            }
        )
        .exec(&mut *db)
        .await
        .expect("fail active walks if present");
    }
}

#[async_trait::async_trait]
impl ActiveWalkCommands for ToastyWalkRepository {
    async fn fail_if_present(&self, owner_id: &str) {
        WalkRepository::fail_if_present(self, owner_id).await;
    }
}
