//! Walk HTTP response mapping.

use serde::Serialize;

use crate::modules::walks::types::{
    CompletedWalk, ConfirmedTrackPoint, RecordingWalk, TrackPoint, WalkEvent, WalkParticipant,
};
use crate::shared::time_format::to_iso8601_millis;

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
            started_at: to_iso8601_millis(walk.started_at),
            completed_at: None,
            participants: walk.participants.iter().map(WalkParticipantBody::from).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletedWalkBody {
    pub walk_id: String,
    pub owner_id: String,
    pub state: &'static str,
    pub started_at: String,
    pub completed_at: String,
    pub duration_seconds: i64,
    pub distance_meters: i32,
    pub pace_seconds_per_meter: Option<f64>,
    pub participants: Vec<WalkParticipantBody>,
}

impl From<&CompletedWalk> for CompletedWalkBody {
    fn from(walk: &CompletedWalk) -> Self {
        Self {
            walk_id: walk.walk_id.clone(),
            owner_id: walk.owner_id.clone(),
            state: "completed",
            started_at: to_iso8601_millis(walk.started_at),
            completed_at: to_iso8601_millis(walk.completed_at),
            duration_seconds: walk.duration_seconds,
            distance_meters: walk.distance_meters,
            pace_seconds_per_meter: walk.pace_seconds_per_meter,
            participants: walk.participants.iter().map(WalkParticipantBody::from).collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackPointBody {
    pub track_point_id: String,
    pub walk_id: String,
    pub recorded_at: String,
    pub latitude: f64,
    pub longitude: f64,
}

impl From<&TrackPoint> for TrackPointBody {
    fn from(point: &TrackPoint) -> Self {
        Self {
            track_point_id: point.track_point_id.clone(),
            walk_id: point.walk_id.clone(),
            recorded_at: to_iso8601_millis(point.recorded_at),
            latitude: point.latitude,
            longitude: point.longitude,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailTrackPointBody {
    pub recorded_at: String,
    pub latitude: f64,
    pub longitude: f64,
}

impl From<&ConfirmedTrackPoint> for DetailTrackPointBody {
    fn from(point: &ConfirmedTrackPoint) -> Self {
        Self {
            recorded_at: to_iso8601_millis(point.recorded_at),
            latitude: point.latitude,
            longitude: point.longitude,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailEventBody {
    pub event_id: String,
    pub participant_dog_id: String,
    #[serde(rename = "type")]
    pub event_type: &'static str,
    pub occurred_at: String,
    pub latitude: f64,
    pub longitude: f64,
}

impl From<&WalkEvent> for DetailEventBody {
    fn from(event: &WalkEvent) -> Self {
        Self {
            event_id: event.event_id.clone(),
            participant_dog_id: event.participant_dog_id.clone(),
            event_type: event.event_type.as_str(),
            occurred_at: to_iso8601_millis(event.occurred_at),
            latitude: event.latitude,
            longitude: event.longitude,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventBody {
    pub event_id: String,
    pub walk_id: String,
    pub participant_dog_id: String,
    #[serde(rename = "type")]
    pub event_type: &'static str,
    pub occurred_at: String,
    pub latitude: f64,
    pub longitude: f64,
}

impl From<&WalkEvent> for EventBody {
    fn from(event: &WalkEvent) -> Self {
        Self {
            event_id: event.event_id.clone(),
            walk_id: event.walk_id.clone(),
            participant_dog_id: event.participant_dog_id.clone(),
            event_type: event.event_type.as_str(),
            occurred_at: to_iso8601_millis(event.occurred_at),
            latitude: event.latitude,
            longitude: event.longitude,
        }
    }
}
