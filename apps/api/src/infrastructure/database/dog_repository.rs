//! Toasty DogRepository — mirrors Drizzle `createDrizzleDogRepository`.

use std::sync::Arc;

use toasty::Db;
use tokio::sync::Mutex;

use crate::infrastructure::database::dog_model::{
    DogGender, DogRecord, GoalPeriod, GoalRevisionRecord,
};
use crate::modules::dogs::errors::DogNameDuplicateError;
use crate::modules::dogs::repository::DogRepository;
use crate::modules::dogs::types::{
    CreateDogInput, CurrentGoal, Dog, Gender, GoalPeriodLiteral,
};

pub struct ToastyDogRepository {
    db: Arc<Mutex<Db>>,
}

impl ToastyDogRepository {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }
}

fn to_gender(gender: DogGender) -> Gender {
    match gender {
        DogGender::Male => Gender::Male,
        DogGender::Female => Gender::Female,
        DogGender::Unknown => Gender::Unknown,
    }
}

fn from_gender(gender: Gender) -> DogGender {
    match gender {
        Gender::Male => DogGender::Male,
        Gender::Female => DogGender::Female,
        Gender::Unknown => DogGender::Unknown,
    }
}

fn to_dog(dog: DogRecord, revision: GoalRevisionRecord) -> Dog {
    assert!(
        matches!(revision.period, GoalPeriod::Daily),
        "current goal period must be daily"
    );
    Dog {
        dog_id: dog.dog_id.to_string(),
        owner_id: dog.owner_id.to_string(),
        name: dog.name,
        gender: to_gender(dog.gender),
        birthday: (*dog.birthday).clone(),
        avatar_url: None,
        created_at: dog.created_at,
        updated_at: dog.updated_at,
        current_goal: CurrentGoal {
            goal_revision_id: revision.goal_revision_id.to_string(),
            period: GoalPeriodLiteral::Daily,
            minutes: revision.minutes,
            effective_from: revision.effective_from,
            effective_to: revision.effective_to,
        },
    }
}

fn is_unique_violation(error: &toasty::Error) -> bool {
    let message = error.to_string().to_ascii_lowercase();
    message.contains("23505")
        || message.contains("unique")
        || message.contains("duplicate key")
}

async fn current_goal_for(
    db: &mut Db,
    dog_id: uuid::Uuid,
) -> GoalRevisionRecord {
    let revisions: Vec<GoalRevisionRecord> = GoalRevisionRecord::filter(
        GoalRevisionRecord::fields()
            .dog_id()
            .eq(dog_id)
            .and(GoalRevisionRecord::fields().effective_to().is_none()),
    )
    .exec(db)
    .await
    .expect("current goal revision query");
    revisions
        .into_iter()
        .next()
        .expect("dog must have a current goal revision")
}

#[async_trait::async_trait]
impl DogRepository for ToastyDogRepository {
    async fn list_by_owner(&self, owner_id: &str) -> Vec<Dog> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let mut db = self.db.lock().await;
        let dogs: Vec<DogRecord> = DogRecord::filter_by_owner_id(owner_uuid)
            .exec(&mut *db)
            .await
            .expect("list dogs by owner");
        let mut result = Vec::with_capacity(dogs.len());
        for dog in dogs {
            let revision = current_goal_for(&mut db, dog.dog_id).await;
            result.push(to_dog(dog, revision));
        }
        result
    }

    async fn create_with_daily_goal(
        &self,
        owner_id: &str,
        input: &CreateDogInput,
    ) -> Result<Dog, DogNameDuplicateError> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let mut db = self.db.lock().await;
        let mut tx = db.transaction().await.expect("begin dog create transaction");

        let dog = match toasty::create!(DogRecord {
            owner_id: owner_uuid,
            name: input.name.clone(),
            gender: from_gender(input.gender),
            birthday: input.birthday.clone(),
        })
        .exec(&mut tx)
        .await
        {
            Ok(dog) => dog,
            Err(error) if is_unique_violation(&error) => {
                return Err(DogNameDuplicateError);
            }
            Err(error) => panic!("dog insert failed: {error}"),
        };

        let revision = toasty::create!(GoalRevisionRecord {
            dog_id: dog.dog_id,
            period: GoalPeriod::Daily,
            minutes: 30,
            effective_from: dog.created_at,
        })
        .exec(&mut tx)
        .await
        .expect("goal revision insert");

        tx.commit().await.expect("commit dog create transaction");
        Ok(to_dog(dog, revision))
    }

    async fn get_by_owner_and_id(&self, owner_id: &str, dog_id: &str) -> Option<Dog> {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let dog_uuid: uuid::Uuid = dog_id.parse().expect("dog_id uuid");
        let mut db = self.db.lock().await;
        let dog = match DogRecord::get_by_dog_id(&mut *db, dog_uuid).await {
            Ok(dog) => dog,
            Err(error) if error.is_record_not_found() => return None,
            Err(error) => panic!("get dog failed: {error}"),
        };
        if dog.owner_id != owner_uuid {
            return None;
        }
        let revision = current_goal_for(&mut db, dog.dog_id).await;
        Some(to_dog(dog, revision))
    }
}
