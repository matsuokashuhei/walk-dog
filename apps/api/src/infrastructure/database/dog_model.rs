//! Toasty models for Drizzle `dogs` and `goal_revisions` tables.

use crate::modules::dogs::types::Birthday;

#[derive(Debug, Clone, PartialEq, Eq, toasty::Embed)]
#[column(type = enum("dog_gender"))]
pub enum DogGender {
    Male,
    Female,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, toasty::Embed)]
#[column(type = enum("goal_period"))]
pub enum GoalPeriod {
    Daily,
    Weekly,
}

#[derive(Debug, toasty::Model)]
#[table = "dogs"]
#[unique(name = "dogs_owner_id_name_unique", owner_id, name)]
pub struct DogRecord {
    #[key]
    #[auto]
    pub dog_id: uuid::Uuid,

    pub owner_id: uuid::Uuid,

    pub name: String,

    pub gender: DogGender,

    #[column(type = jsonb)]
    pub birthday: toasty::Json<Birthday>,

    #[auto]
    pub created_at: jiff::Timestamp,

    #[auto]
    pub updated_at: jiff::Timestamp,
}

#[derive(Debug, toasty::Model)]
#[table = "goal_revisions"]
pub struct GoalRevisionRecord {
    #[key]
    #[auto]
    pub goal_revision_id: uuid::Uuid,

    #[index]
    pub dog_id: uuid::Uuid,

    pub period: GoalPeriod,

    pub minutes: i32,

    pub effective_from: jiff::Timestamp,

    pub effective_to: Option<jiff::Timestamp>,

    #[auto]
    pub created_at: jiff::Timestamp,
}
