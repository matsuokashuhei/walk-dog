//! Walk HTTP response mapping.

use serde::Serialize;

use crate::modules::walks::types::{RecordingWalk, WalkParticipant};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalkParticipantBody {
    pub walk_participant_id: String,
    pub dog_id: String,
    pub name: String,
}

impl From<&WalkParticipant> for WalkParticipantBody {
    fn from(participant: &WalkParticipant) -> Self {
        Self {
            walk_participant_id: participant.walk_participant_id.clone(),
            dog_id: participant.dog_id.clone(),
            name: participant.name.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingWalkBody {
    pub walk_id: String,
    pub owner_id: String,
    pub state: &'static str,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub participants: Vec<WalkParticipantBody>,
}

impl From<&RecordingWalk> for RecordingWalkBody {
    fn from(walk: &RecordingWalk) -> Self {
        Self {
            walk_id: walk.walk_id.clone(),
            owner_id: walk.owner_id.clone(),
            state: "recording",
            started_at: walk.started_at.to_string(),
            completed_at: None,
            participants: walk.participants.iter().map(WalkParticipantBody::from).collect(),
        }
    }
}
