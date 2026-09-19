//! Toasty models for Drizzle walks tables (participants, command keys, track points, events).

#[derive(Debug, Clone, PartialEq, Eq, toasty::Embed)]
#[column(type = enum("walk_state"))]
pub enum WalkState {
    Recording,
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, toasty::Embed)]
#[column(type = enum("walk_command_namespace"))]
pub enum WalkCommandNamespace {
    Start,
    Finish,
}

#[derive(Debug, Clone, PartialEq, Eq, toasty::Embed)]
#[column(type = enum("walk_event_type"))]
pub enum WalkEventTypeRecord {
    Pee,
    Poop,
    Sniff,
    Greet,
}

#[derive(Debug, toasty::Model)]
#[table = "walks"]
pub struct WalkRecord {
    #[key]
    #[auto]
    pub walk_id: uuid::Uuid,

    #[index]
    pub owner_id: uuid::Uuid,

    pub state: WalkState,

    pub started_at: jiff::Timestamp,

    pub completed_at: Option<jiff::Timestamp>,

    pub distance_meters: Option<i32>,

    #[auto]
    pub created_at: jiff::Timestamp,

    #[auto]
    pub updated_at: jiff::Timestamp,
}

#[derive(Debug, toasty::Model)]
#[table = "walk_participants"]
#[unique(name = "walk_participants_walk_id_dog_id_unique", walk_id, dog_id)]
pub struct WalkParticipantRecord {
    #[key]
    #[auto]
    pub walk_participant_id: uuid::Uuid,

    #[index]
    pub walk_id: uuid::Uuid,

    pub dog_id: uuid::Uuid,

    pub name: String,

    pub position: i32,

    #[auto]
    pub created_at: jiff::Timestamp,
}

#[derive(Debug, toasty::Model)]
#[table = "walk_command_keys"]
#[unique(
    name = "walk_command_keys_owner_id_namespace_key_unique",
    owner_id,
    namespace,
    key
)]
pub struct WalkCommandKeyRecord {
    #[key]
    #[auto]
    pub walk_command_key_id: uuid::Uuid,

    pub owner_id: uuid::Uuid,

    pub namespace: WalkCommandNamespace,

    pub key: String,

    pub body_hash: String,

    pub walk_id: uuid::Uuid,

    #[auto]
    pub created_at: jiff::Timestamp,
}

#[derive(Debug, toasty::Model)]
#[table = "walk_track_points"]
#[unique(
    name = "walk_track_points_walk_id_recorded_at_unique",
    walk_id,
    recorded_at
)]
pub struct WalkTrackPointRecord {
    #[key]
    #[auto]
    pub track_point_id: uuid::Uuid,

    #[index]
    pub walk_id: uuid::Uuid,

    pub recorded_at: jiff::Timestamp,

    pub latitude: f64,

    pub longitude: f64,

    #[auto]
    pub created_at: jiff::Timestamp,
}

#[derive(Debug, toasty::Model)]
#[table = "walk_events"]
pub struct WalkEventRecord {
    #[key]
    pub event_id: uuid::Uuid,

    #[index]
    pub walk_id: uuid::Uuid,

    pub participant_dog_id: uuid::Uuid,

    #[column("type")]
    pub event_type: WalkEventTypeRecord,

    pub occurred_at: jiff::Timestamp,

    pub latitude: f64,

    pub longitude: f64,

    #[auto]
    pub created_at: jiff::Timestamp,
}
