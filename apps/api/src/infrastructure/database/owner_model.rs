//! Toasty model for the existing Drizzle `owners` table.

#[derive(Debug, toasty::Model)]
#[table = "owners"]
pub struct OwnerRecord {
    #[key]
    #[auto]
    pub owner_id: uuid::Uuid,

    #[unique]
    pub cognito_subject: String,

    pub display_name: Option<String>,

    #[auto]
    pub created_at: jiff::Timestamp,

    #[auto]
    pub updated_at: jiff::Timestamp,
}
