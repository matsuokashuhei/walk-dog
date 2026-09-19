//! Dog domain types — mirrors TypeScript `modules/dogs/types.ts`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Gender {
    Male,
    Female,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "precision")]
pub enum Birthday {
    #[serde(rename = "unknown")]
    Unknown,
    #[serde(rename = "year")]
    Year { year: i32 },
    #[serde(rename = "month")]
    Month { year: i32, month: i32 },
    #[serde(rename = "day")]
    Day { year: i32, month: i32, day: i32 },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CurrentGoal {
    pub goal_revision_id: String,
    pub period: GoalPeriodLiteral,
    pub minutes: i32,
    pub effective_from: jiff::Timestamp,
    pub effective_to: Option<jiff::Timestamp>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum GoalPeriodLiteral {
    Daily,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Dog {
    pub dog_id: String,
    pub owner_id: String,
    pub name: String,
    pub gender: Gender,
    pub birthday: Birthday,
    pub avatar_url: Option<String>,
    pub created_at: jiff::Timestamp,
    pub updated_at: jiff::Timestamp,
    pub current_goal: CurrentGoal,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateDogInput {
    pub name: String,
    pub gender: Gender,
    pub birthday: Birthday,
}
