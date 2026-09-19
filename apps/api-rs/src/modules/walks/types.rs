//! Walk domain types — mirrors TypeScript `modules/walks/types.ts`.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WalkParticipant {
    pub walk_participant_id: String,
    pub dog_id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordingWalk {
    pub walk_id: String,
    pub owner_id: String,
    pub started_at: jiff::Timestamp,
    pub participants: Vec<WalkParticipant>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompletedWalk {
    pub walk_id: String,
    pub owner_id: String,
    pub started_at: jiff::Timestamp,
    pub completed_at: jiff::Timestamp,
    pub duration_seconds: i64,
    pub distance_meters: i32,
    pub pace_seconds_per_meter: Option<f64>,
    pub participants: Vec<WalkParticipant>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartWalkInput {
    pub owner_id: String,
    pub participant_dog_ids: Vec<String>,
    pub idempotency_key: String,
    pub body_hash: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FinishWalkInput {
    pub owner_id: String,
    pub walk_id: String,
    pub idempotency_key: String,
    pub body_hash: String,
    pub distance_meters: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrackPoint {
    pub track_point_id: String,
    pub walk_id: String,
    pub recorded_at: jiff::Timestamp,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AcceptTrackPointInput {
    pub owner_id: String,
    pub walk_id: String,
    pub recorded_at: jiff::Timestamp,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WalkEventType {
    Pee,
    Poop,
    Sniff,
    Greet,
}

impl WalkEventType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pee => "pee",
            Self::Poop => "poop",
            Self::Sniff => "sniff",
            Self::Greet => "greet",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct WalkEvent {
    pub event_id: String,
    pub walk_id: String,
    pub participant_dog_id: String,
    pub event_type: WalkEventType,
    pub occurred_at: jiff::Timestamp,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ConfirmedTrackPoint {
    pub recorded_at: jiff::Timestamp,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WalkDetail {
    pub walk: CompletedWalk,
    pub track_points: Vec<ConfirmedTrackPoint>,
    pub events: Vec<WalkEvent>,
}
