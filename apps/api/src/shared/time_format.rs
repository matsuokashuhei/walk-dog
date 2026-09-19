//! Timestamp formatting aligned with JavaScript `Date.prototype.toISOString()`.

/// Formats `ts` as UTC ISO-8601 with millisecond precision (`…T12:00:00.000Z`).
pub fn to_iso8601_millis(ts: jiff::Timestamp) -> String {
    ts.strftime("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_whole_seconds_with_millis() {
        let ts: jiff::Timestamp = "2026-08-17T12:00:00Z".parse().unwrap();
        assert_eq!(to_iso8601_millis(ts), "2026-08-17T12:00:00.000Z");
    }

    #[test]
    fn formats_existing_millis() {
        let ts: jiff::Timestamp = "2026-08-17T12:00:00.123Z".parse().unwrap();
        assert_eq!(to_iso8601_millis(ts), "2026-08-17T12:00:00.123Z");
    }
}
