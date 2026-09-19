//! Toasty WalkRepository — mirrors Drizzle `createDrizzleWalkRepository`.

use std::collections::HashMap;
use std::sync::Arc;

use toasty::Db;
use tokio::sync::Mutex;

use crate::infrastructure::database::dog_model::DogRecord;
use crate::infrastructure::database::numeric_coordinate::{
    f64_to_numeric_coord, numeric_coord_to_f64,
};
use crate::infrastructure::database::walk_model::{
    WalkCommandKeyRecord, WalkCommandNamespace, WalkEventRecord, WalkEventTypeRecord,
    WalkParticipantRecord, WalkRecord, WalkState, WalkTrackPointRecord,
};
use crate::modules::walks::active_walk_commands::ActiveWalkCommands;
use crate::modules::walks::errors::{
    ActiveWalkExistsError, IdempotencyConflictError, WalkNotFoundError, WalkNotRecordingError,
};
use crate::modules::walks::path_distance::pace_seconds_per_meter;
use crate::modules::walks::repository::{
    AcceptTrackPointError, FailWalkError, FinishWalkError, ListAcceptedError, RecordEventError,
    StartWalkError, WalkRepository,
};
use crate::modules::walks::types::{
    AcceptTrackPointInput, CompletedWalk, FinishWalkInput, RecordEventInput, RecordedEvent,
    RecordingWalk, StartWalkInput, TrackPoint, WalkEvent, WalkEventType, WalkParticipant,
};

const RECORDING_UNIQUE: &str = "walks_owner_id_recording_unique";
const COMMAND_KEY_UNIQUE: &str = "walk_command_keys_owner_id_namespace_key_unique";
const TRACK_POINT_UNIQUE: &str = "walk_track_points_walk_id_recorded_at_unique";
const EVENT_PKEY: &str = "walk_events_pkey";

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

fn to_completed_walk(walk: WalkRecord, participants: Vec<WalkParticipantRecord>) -> CompletedWalk {
    let completed_at = walk.completed_at.expect("completed walk has completed_at");
    let duration_seconds = completed_at
        .duration_since(walk.started_at)
        .as_secs()
        .max(0);
    let distance_meters = walk.distance_meters.unwrap_or(0);
    CompletedWalk {
        walk_id: walk.walk_id.to_string(),
        owner_id: walk.owner_id.to_string(),
        started_at: walk.started_at,
        completed_at,
        duration_seconds,
        distance_meters,
        pace_seconds_per_meter: pace_seconds_per_meter(duration_seconds, distance_meters),
        participants: participants.into_iter().map(to_participant).collect(),
    }
}

fn to_track_point(row: WalkTrackPointRecord) -> TrackPoint {
    TrackPoint {
        track_point_id: row.track_point_id.to_string(),
        walk_id: row.walk_id.to_string(),
        recorded_at: row.recorded_at,
        latitude: numeric_coord_to_f64(row.latitude),
        longitude: numeric_coord_to_f64(row.longitude),
    }
}

fn to_event_type(value: WalkEventTypeRecord) -> WalkEventType {
    match value {
        WalkEventTypeRecord::Pee => WalkEventType::Pee,
        WalkEventTypeRecord::Poop => WalkEventType::Poop,
        WalkEventTypeRecord::Sniff => WalkEventType::Sniff,
        WalkEventTypeRecord::Greet => WalkEventType::Greet,
    }
}

fn from_event_type(value: WalkEventType) -> WalkEventTypeRecord {
    match value {
        WalkEventType::Pee => WalkEventTypeRecord::Pee,
        WalkEventType::Poop => WalkEventTypeRecord::Poop,
        WalkEventType::Sniff => WalkEventTypeRecord::Sniff,
        WalkEventType::Greet => WalkEventTypeRecord::Greet,
    }
}

fn to_walk_event(row: WalkEventRecord) -> WalkEvent {
    WalkEvent {
        event_id: row.event_id.to_string(),
        walk_id: row.walk_id.to_string(),
        participant_dog_id: row.participant_dog_id.to_string(),
        event_type: to_event_type(row.event_type),
        occurred_at: row.occurred_at,
        latitude: numeric_coord_to_f64(row.latitude),
        longitude: numeric_coord_to_f64(row.longitude),
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

fn is_track_point_unique(error: &toasty::Error) -> bool {
    error_message(error).contains(TRACK_POINT_UNIQUE)
}

fn is_event_pkey(error: &toasty::Error) -> bool {
    error_message(error).contains(EVENT_PKEY)
}

async fn select_participants(db: &mut Db, walk_id: uuid::Uuid) -> Vec<WalkParticipantRecord> {
    let mut rows: Vec<WalkParticipantRecord> = WalkParticipantRecord::filter_by_walk_id(walk_id)
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

async fn load_completed_walk(db: &mut Db, walk_id: uuid::Uuid) -> CompletedWalk {
    let walk = WalkRecord::get_by_walk_id(&mut *db, walk_id)
        .await
        .expect("load completed walk");
    let participants = select_participants(db, walk_id).await;
    to_completed_walk(walk, participants)
}

async fn select_owned_walk(
    db: &mut Db,
    owner_id: uuid::Uuid,
    walk_id: uuid::Uuid,
) -> Result<WalkRecord, WalkNotFoundError> {
    let walk = match WalkRecord::get_by_walk_id(&mut *db, walk_id).await {
        Ok(walk) => walk,
        Err(error) if error.is_record_not_found() => return Err(WalkNotFoundError),
        Err(error) => panic!("get walk: {error}"),
    };
    if walk.owner_id != owner_id {
        return Err(WalkNotFoundError);
    }
    Ok(walk)
}

async fn resolve_command(
    db: &mut Db,
    owner_id: uuid::Uuid,
    namespace: WalkCommandNamespace,
    key: &str,
    body_hash: &str,
) -> Result<Option<WalkCommandKeyRecord>, IdempotencyConflictError> {
    let rows: Vec<WalkCommandKeyRecord> = WalkCommandKeyRecord::filter(
        WalkCommandKeyRecord::fields()
            .owner_id()
            .eq(owner_id)
            .and(WalkCommandKeyRecord::fields().namespace().eq(namespace))
            .and(WalkCommandKeyRecord::fields().key().eq(key)),
    )
    .exec(db)
    .await
    .expect("resolve walk command key");
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
    if let Some(existing) = resolve_command(
        db,
        owner_uuid,
        WalkCommandNamespace::Start,
        &input.idempotency_key,
        &input.body_hash,
    )
    .await?
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
    match resolve_command(
        db,
        owner_uuid,
        WalkCommandNamespace::Start,
        &input.idempotency_key,
        &input.body_hash,
    )
    .await?
    {
        Some(existing) => Ok(load_recording_walk(db, existing.walk_id).await),
        None => Err(StartWalkError::IdempotencyConflict(IdempotencyConflictError)),
    }
}

async fn finish_walk_tx(
    db: &mut Db,
    input: &FinishWalkInput,
) -> Result<CompletedWalk, FinishWalkError> {
    let owner_uuid: uuid::Uuid = input.owner_id.parse().expect("owner_id uuid");
    let walk_uuid: uuid::Uuid = input.walk_id.parse().expect("walk_id uuid");

    if let Some(existing) = resolve_command(
        db,
        owner_uuid,
        WalkCommandNamespace::Finish,
        &input.idempotency_key,
        &input.body_hash,
    )
    .await?
    {
        return Ok(load_completed_walk(db, existing.walk_id).await);
    }

    let walk = select_owned_walk(db, owner_uuid, walk_uuid).await?;
    if walk.state != WalkState::Recording {
        return Err(FinishWalkError::NotRecording(WalkNotRecordingError));
    }

    let mut tx = db
        .transaction()
        .await
        .expect("begin walk finish transaction");

    toasty::update!(
        WalkRecord::filter(
            WalkRecord::fields()
                .walk_id()
                .eq(walk_uuid)
                .and(WalkRecord::fields().owner_id().eq(owner_uuid))
                .and(WalkRecord::fields().state().eq(WalkState::Recording))
        ) {
            state: WalkState::Completed,
            completed_at: Some(jiff::Timestamp::now()),
            distance_meters: Some(input.distance_meters)
        }
    )
    .exec(&mut tx)
    .await
    .expect("complete recording walk");

    let updated = match WalkRecord::get_by_walk_id(&mut tx, walk_uuid).await {
        Ok(walk) => walk,
        Err(error) => panic!("get walk after finish: {error}"),
    };
    if updated.state != WalkState::Completed {
        return Err(FinishWalkError::NotRecording(WalkNotRecordingError));
    }

    match toasty::create!(WalkCommandKeyRecord {
        owner_id: owner_uuid,
        namespace: WalkCommandNamespace::Finish,
        key: input.idempotency_key.clone(),
        body_hash: input.body_hash.clone(),
        walk_id: walk_uuid,
    })
    .exec(&mut tx)
    .await
    {
        Ok(_) => {}
        Err(error) if is_command_key_unique(&error) => {
            drop(tx);
            return replay_finish(db, input).await;
        }
        Err(error) => panic!("finish command key insert failed: {error}"),
    }

    tx.commit().await.expect("commit walk finish transaction");
    let participants = select_participants(db, walk_uuid).await;
    Ok(to_completed_walk(updated, participants))
}

async fn replay_finish(
    db: &mut Db,
    input: &FinishWalkInput,
) -> Result<CompletedWalk, FinishWalkError> {
    let owner_uuid: uuid::Uuid = input.owner_id.parse().expect("owner_id uuid");
    match resolve_command(
        db,
        owner_uuid,
        WalkCommandNamespace::Finish,
        &input.idempotency_key,
        &input.body_hash,
    )
    .await?
    {
        Some(existing) => Ok(load_completed_walk(db, existing.walk_id).await),
        None => Err(FinishWalkError::IdempotencyConflict(IdempotencyConflictError)),
    }
}

async fn accept_track_point_tx(
    db: &mut Db,
    input: &AcceptTrackPointInput,
) -> Result<TrackPoint, AcceptTrackPointError> {
    let owner_uuid: uuid::Uuid = input.owner_id.parse().expect("owner_id uuid");
    let walk_uuid: uuid::Uuid = input.walk_id.parse().expect("walk_id uuid");
    let walk = select_owned_walk(db, owner_uuid, walk_uuid).await?;
    if walk.state != WalkState::Recording {
        return Err(AcceptTrackPointError::NotRecording(WalkNotRecordingError));
    }

    match toasty::create!(WalkTrackPointRecord {
        walk_id: walk_uuid,
        recorded_at: input.recorded_at,
        latitude: f64_to_numeric_coord(input.latitude),
        longitude: f64_to_numeric_coord(input.longitude),
    })
    .exec(db)
    .await
    {
        Ok(row) => Ok(to_track_point(row)),
        Err(error) if is_track_point_unique(&error) => {
            replay_accepted_track_point(db, input).await
        }
        Err(error) => panic!("accept track point insert failed: {error}"),
    }
}

async fn replay_accepted_track_point(
    db: &mut Db,
    input: &AcceptTrackPointInput,
) -> Result<TrackPoint, AcceptTrackPointError> {
    let walk_uuid: uuid::Uuid = input.walk_id.parse().expect("walk_id uuid");
    let rows: Vec<WalkTrackPointRecord> = WalkTrackPointRecord::filter(
        WalkTrackPointRecord::fields()
            .walk_id()
            .eq(walk_uuid)
            .and(
                WalkTrackPointRecord::fields()
                    .recorded_at()
                    .eq(input.recorded_at),
            ),
    )
    .exec(db)
    .await
    .expect("replay accepted track point");
    let row = rows
        .into_iter()
        .next()
        .expect("unique track point exists after conflict");
    if (numeric_coord_to_f64(row.latitude) - input.latitude).abs() < f64::EPSILON
        && (numeric_coord_to_f64(row.longitude) - input.longitude).abs() < f64::EPSILON
    {
        return Ok(to_track_point(row));
    }
    Err(AcceptTrackPointError::IdempotencyConflict(
        IdempotencyConflictError,
    ))
}

async fn record_event_tx(
    db: &mut Db,
    input: &RecordEventInput,
) -> Result<RecordedEvent, RecordEventError> {
    let owner_uuid: uuid::Uuid = input.owner_id.parse().expect("owner_id uuid");
    let walk_uuid: uuid::Uuid = input.walk_id.parse().expect("walk_id uuid");
    let event_uuid: uuid::Uuid = input.event_id.parse().expect("event_id uuid");
    let dog_uuid: uuid::Uuid = input
        .participant_dog_id
        .parse()
        .expect("participant_dog_id uuid");

    let walk = select_owned_walk(db, owner_uuid, walk_uuid).await?;
    if walk.state != WalkState::Recording {
        return Err(RecordEventError::NotRecording(WalkNotRecordingError));
    }

    let participants: Vec<WalkParticipantRecord> = WalkParticipantRecord::filter(
        WalkParticipantRecord::fields()
            .walk_id()
            .eq(walk_uuid)
            .and(WalkParticipantRecord::fields().dog_id().eq(dog_uuid)),
    )
    .exec(db)
    .await
    .expect("check walk participant for event");
    if participants.is_empty() {
        return Err(RecordEventError::NotFound(WalkNotFoundError));
    }

    match toasty::create!(WalkEventRecord {
        event_id: event_uuid,
        walk_id: walk_uuid,
        participant_dog_id: dog_uuid,
        event_type: from_event_type(input.event_type),
        occurred_at: input.occurred_at,
        latitude: f64_to_numeric_coord(input.latitude),
        longitude: f64_to_numeric_coord(input.longitude),
    })
    .exec(db)
    .await
    {
        Ok(row) => Ok(RecordedEvent {
            event: to_walk_event(row),
            created: true,
        }),
        Err(error) if is_event_pkey(&error) => replay_recorded_event(db, input).await,
        Err(error) => panic!("record event insert failed: {error}"),
    }
}

async fn replay_recorded_event(
    db: &mut Db,
    input: &RecordEventInput,
) -> Result<RecordedEvent, RecordEventError> {
    let event_uuid: uuid::Uuid = input.event_id.parse().expect("event_id uuid");
    let row = WalkEventRecord::get_by_event_id(&mut *db, event_uuid)
        .await
        .expect("replay recorded event");
    if row.participant_dog_id.to_string() == input.participant_dog_id
        && to_event_type(row.event_type.clone()) == input.event_type
        && row.occurred_at == input.occurred_at
        && numeric_coord_to_f64(row.latitude) == input.latitude
        && numeric_coord_to_f64(row.longitude) == input.longitude
    {
        return Ok(RecordedEvent {
            event: to_walk_event(row),
            created: false,
        });
    }
    Err(RecordEventError::IdempotencyConflict(
        IdempotencyConflictError,
    ))
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

    async fn get_completed_by_owner(
        &self,
        owner_id: &str,
        walk_id: &str,
    ) -> Result<CompletedWalk, WalkNotFoundError> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let walk_uuid: uuid::Uuid = walk_id.parse().expect("walk_id uuid");
        let mut db = self.db.lock().await;
        let walk = select_owned_walk(&mut db, owner_uuid, walk_uuid).await?;
        if walk.state != WalkState::Completed {
            return Err(WalkNotFoundError);
        }
        let participants = select_participants(&mut db, walk_uuid).await;
        Ok(to_completed_walk(walk, participants))
    }

    async fn start(&self, input: &StartWalkInput) -> Result<RecordingWalk, StartWalkError> {
        let mut db = self.db.lock().await;
        start_walk_tx(&mut db, input).await
    }

    async fn finish(&self, input: &FinishWalkInput) -> Result<CompletedWalk, FinishWalkError> {
        let mut db = self.db.lock().await;
        finish_walk_tx(&mut db, input).await
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
            WalkState::Recording => Err(FailWalkError::NotRecording(WalkNotRecordingError)),
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

    async fn accept_track_point(
        &self,
        input: &AcceptTrackPointInput,
    ) -> Result<TrackPoint, AcceptTrackPointError> {
        let mut db = self.db.lock().await;
        accept_track_point_tx(&mut db, input).await
    }

    async fn record_event(
        &self,
        input: &RecordEventInput,
    ) -> Result<RecordedEvent, RecordEventError> {
        let mut db = self.db.lock().await;
        record_event_tx(&mut db, input).await
    }

    async fn list_accepted_recorded_at(
        &self,
        owner_id: &str,
        walk_id: &str,
    ) -> Result<Vec<jiff::Timestamp>, ListAcceptedError> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let walk_uuid: uuid::Uuid = walk_id.parse().expect("walk_id uuid");
        let mut db = self.db.lock().await;
        let walk = select_owned_walk(&mut db, owner_uuid, walk_uuid).await?;
        if walk.state != WalkState::Recording {
            return Err(ListAcceptedError::NotRecording(WalkNotRecordingError));
        }
        let mut rows: Vec<WalkTrackPointRecord> =
            WalkTrackPointRecord::filter_by_walk_id(walk_uuid)
                .exec(&mut *db)
                .await
                .expect("list accepted track points");
        rows.sort_by_key(|row| row.recorded_at);
        Ok(rows.into_iter().map(|row| row.recorded_at).collect())
    }

    async fn list_events(&self, walk_id: &str) -> Vec<WalkEvent> {
        let walk_uuid: uuid::Uuid = walk_id.parse().expect("walk_id uuid");
        let mut db = self.db.lock().await;
        let mut rows: Vec<WalkEventRecord> = WalkEventRecord::filter_by_walk_id(walk_uuid)
            .exec(&mut *db)
            .await
            .expect("list walk events");
        rows.sort_by_key(|row| row.occurred_at);
        rows.into_iter().map(to_walk_event).collect()
    }
}

#[async_trait::async_trait]
impl ActiveWalkCommands for ToastyWalkRepository {
    async fn fail_if_present(&self, owner_id: &str) {
        WalkRepository::fail_if_present(self, owner_id).await;
    }
}
