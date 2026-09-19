//! Haversine path distance — mirrors TypeScript `path-distance.ts`.

const EARTH_RADIUS_METERS: f64 = 6_371_000.0;

fn haversine_meters(
    latitude1: f64,
    longitude1: f64,
    latitude2: f64,
    longitude2: f64,
) -> f64 {
    let to_radians = |degrees: f64| degrees * std::f64::consts::PI / 180.0;
    let delta_latitude = to_radians(latitude2 - latitude1);
    let delta_longitude = to_radians(longitude2 - longitude1);
    let chord = (delta_latitude / 2.0).sin().powi(2)
        + to_radians(latitude1).cos()
            * to_radians(latitude2).cos()
            * (delta_longitude / 2.0).sin().powi(2);
    let central_angle = 2.0 * chord.sqrt().atan2((1.0 - chord).sqrt());
    EARTH_RADIUS_METERS * central_angle
}

pub fn path_distance_meters(points: &[(f64, f64)]) -> i32 {
    if points.len() < 2 {
        return 0;
    }
    let mut total_meters = 0.0;
    for window in points.windows(2) {
        let (lat1, lon1) = window[0];
        let (lat2, lon2) = window[1];
        total_meters += haversine_meters(lat1, lon1, lat2, lon2);
    }
    total_meters.round() as i32
}

pub fn pace_seconds_per_meter(duration_seconds: i64, distance_meters: i32) -> Option<f64> {
    if distance_meters <= 0 {
        return None;
    }
    Some(duration_seconds as f64 / f64::from(distance_meters))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_or_single_point_is_zero() {
        assert_eq!(path_distance_meters(&[]), 0);
        assert_eq!(path_distance_meters(&[(35.0, 139.0)]), 0);
    }

    #[test]
    fn two_nearby_points_round_to_positive_meters() {
        let meters = path_distance_meters(&[(35.6812, 139.7671), (35.6813, 139.7672)]);
        assert!(meters > 0);
    }

    #[test]
    fn pace_none_when_distance_zero() {
        assert_eq!(pace_seconds_per_meter(100, 0), None);
        assert_eq!(pace_seconds_per_meter(100, 50), Some(2.0));
    }
}
