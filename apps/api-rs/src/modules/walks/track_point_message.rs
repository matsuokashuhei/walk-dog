//! TrackPoint SQS message JSON — mirrors TypeScript `track-point-message.ts`.

use serde::{Deserialize, Serialize};

use crate::modules::walks::types::TrackPoint;
use crate::shared::time_format::to_iso8601_millis;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrackPointMessageBody {
    track_point_id: String,
    walk_id: String,
    recorded_at: String,
    latitude: f64,
    longitude: f64,
}

pub fn to_track_point_message(track_point: &TrackPoint) -> String {
    let body = TrackPointMessageBody {
        track_point_id: track_point.track_point_id.clone(),
        walk_id: track_point.walk_id.clone(),
        recorded_at: to_iso8601_millis(track_point.recorded_at),
        latitude: track_point.latitude,
        longitude: track_point.longitude,
    };
    serde_json::to_string(&body).expect("track point message json")
}

pub fn parse_track_point_message(body: &str) -> Result<TrackPoint, String> {
    let parsed: TrackPointMessageBody =
        serde_json::from_str(body).map_err(|err| err.to_string())?;
    if !coordinate_in_range(parsed.latitude, parsed.longitude) {
        return Err("coordinates out of range".into());
    }
    if !has_microdegree_scale(parsed.latitude) || !has_microdegree_scale(parsed.longitude) {
        return Err("coordinates exceed numeric scale".into());
    }
    let recorded_at = parsed
        .recorded_at
        .parse::<jiff::Timestamp>()
        .map_err(|err| err.to_string())?;
    Ok(TrackPoint {
        track_point_id: parsed.track_point_id,
        walk_id: parsed.walk_id,
        recorded_at,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
    })
}

fn coordinate_in_range(latitude: f64, longitude: f64) -> bool {
    (-99.999_999..=99.999_999).contains(&latitude)
        && (-999.999_999..=999.999_999).contains(&longitude)
}

fn has_microdegree_scale(value: f64) -> bool {
    let scaled = value * 1_000_000.0;
    (scaled - scaled.round()).abs() < 1e-6
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> TrackPoint {
        TrackPoint {
            track_point_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90".into(),
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            recorded_at: "2026-08-17T12:00:00Z".parse().unwrap(),
            latitude: 35.681_236,
            longitude: 139.767_125,
        }
    }

    #[test]
    fn round_trips_message() {
        let point = sample();
        let message = to_track_point_message(&point);
        assert!(message.contains("\"trackPointId\""));
        assert!(message.contains("\"recordedAt\":\"2026-08-17T12:00:00.000Z\""));
        let parsed = parse_track_point_message(&message).unwrap();
        assert_eq!(parsed.track_point_id, point.track_point_id);
        assert_eq!(parsed.walk_id, point.walk_id);
        assert_eq!(parsed.recorded_at, point.recorded_at);
        assert!((parsed.latitude - point.latitude).abs() < 1e-12);
        assert!((parsed.longitude - point.longitude).abs() < 1e-12);
    }

    #[test]
    fn rejects_incomplete_body() {
        assert!(parse_track_point_message(r#"{"walkId":"x"}"#).is_err());
    }

    #[test]
    fn rejects_excessive_scale() {
        let bad = r#"{
            "trackPointId":"0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90",
            "walkId":"0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80",
            "recordedAt":"2026-08-17T12:00:00Z",
            "latitude":35.6812361,
            "longitude":139.767125
        }"#;
        assert!(parse_track_point_message(bad).is_err());
    }
}
