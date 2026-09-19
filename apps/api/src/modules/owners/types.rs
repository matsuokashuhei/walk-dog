//! Owner domain types.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Owner {
    pub owner_id: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: jiff::Timestamp,
    pub updated_at: jiff::Timestamp,
}
