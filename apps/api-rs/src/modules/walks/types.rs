//! Walk domain types — mirrors TypeScript `modules/walks/types.ts` (Phase 3a slice).

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartWalkInput {
    pub owner_id: String,
    pub participant_dog_ids: Vec<String>,
    pub idempotency_key: String,
    pub body_hash: String,
}
