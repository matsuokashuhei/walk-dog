use serde::Serialize;

/// Shared API error body — matches TypeScript `errorSchema`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    pub request_id: String,
    pub retryable: bool,
}
