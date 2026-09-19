//! Convert between domain `f64` coordinates and PostgreSQL `NUMERIC` via `rust_decimal`.

use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use rust_decimal::Decimal;

const COORD_SCALE: u32 = 6;

pub fn f64_to_numeric_coord(value: f64) -> Decimal {
    Decimal::from_f64(value)
        .expect("coordinate must be a finite f64")
        .round_dp(COORD_SCALE)
}

pub fn numeric_coord_to_f64(value: Decimal) -> f64 {
    value
        .to_f64()
        .expect("numeric coordinate must convert to f64")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_microdegree_latitude() {
        let latitude = 35.681_236;
        let encoded = f64_to_numeric_coord(latitude);
        let decoded = numeric_coord_to_f64(encoded);
        assert!((decoded - latitude).abs() < 1e-12);
    }

    #[test]
    fn round_trips_microdegree_longitude() {
        let longitude = 139.767_125;
        let encoded = f64_to_numeric_coord(longitude);
        let decoded = numeric_coord_to_f64(encoded);
        assert!((decoded - longitude).abs() < 1e-12);
    }

    #[test]
    fn encodes_as_numeric_scale_six() {
        let encoded = f64_to_numeric_coord(35.681_236_1);
        assert_eq!(encoded.scale(), COORD_SCALE);
        assert_eq!(encoded.to_string(), "35.681236");
    }
}
