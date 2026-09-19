//! Dog HTTP response mapping.

use serde::Serialize;

use crate::modules::dogs::types::{Birthday, CurrentGoal, Dog, Gender, GoalPeriodLiteral};
use crate::shared::time_format::to_iso8601_millis;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentGoalBody {
    pub goal_revision_id: String,
    pub period: GoalPeriodLiteral,
    pub minutes: i32,
    pub effective_from: String,
    pub effective_to: Option<String>,
}

impl From<&CurrentGoal> for CurrentGoalBody {
    fn from(goal: &CurrentGoal) -> Self {
        Self {
            goal_revision_id: goal.goal_revision_id.clone(),
            period: goal.period,
            minutes: goal.minutes,
            effective_from: to_iso8601_millis(goal.effective_from),
            effective_to: goal.effective_to.map(to_iso8601_millis),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DogBody {
    pub dog_id: String,
    pub owner_id: String,
    pub name: String,
    pub gender: Gender,
    pub birthday: Birthday,
    pub avatar_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub current_goal: CurrentGoalBody,
}

impl From<&Dog> for DogBody {
    fn from(dog: &Dog) -> Self {
        Self {
            dog_id: dog.dog_id.clone(),
            owner_id: dog.owner_id.clone(),
            name: dog.name.clone(),
            gender: dog.gender,
            birthday: dog.birthday.clone(),
            avatar_url: dog.avatar_url.clone(),
            created_at: to_iso8601_millis(dog.created_at),
            updated_at: to_iso8601_millis(dog.updated_at),
            current_goal: CurrentGoalBody::from(&dog.current_goal),
        }
    }
}
