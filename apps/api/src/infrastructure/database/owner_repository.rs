//! Toasty OwnerRepository — upsert-on-first-seen by cognito_subject.

use std::sync::Arc;

use toasty::Db;
use tokio::sync::Mutex;

use crate::infrastructure::database::owner_model::OwnerRecord;
use crate::modules::owners::repository::OwnerRepository;
use crate::modules::owners::types::Owner;

pub struct ToastyOwnerRepository {
    db: Arc<Mutex<Db>>,
}

impl ToastyOwnerRepository {
    pub fn new(db: Arc<Mutex<Db>>) -> Self {
        Self { db }
    }
}

fn to_owner(record: OwnerRecord) -> Owner {
    Owner {
        owner_id: record.owner_id.to_string(),
        display_name: record.display_name,
        avatar_url: None,
        created_at: record.created_at,
        updated_at: record.updated_at,
    }
}

#[async_trait::async_trait]
impl OwnerRepository for ToastyOwnerRepository {
    async fn resolve_by_cognito_subject(&self, cognito_subject: &str) -> Owner {
        let mut db = self.db.lock().await;
        let inserted: Option<OwnerRecord> = OwnerRecord::upsert_by_cognito_subject(cognito_subject)
            .display_name(None::<String>)
            .or_ignore()
            .exec(&mut *db)
            .await
            .expect("owner upsert");

        if let Some(record) = inserted {
            return to_owner(record);
        }

        let record = OwnerRecord::get_by_cognito_subject(&mut *db, cognito_subject)
            .await
            .expect("owner get after conflict");
        to_owner(record)
    }

    async fn update_display_name(&self, cognito_subject: &str, display_name: &str) -> Owner {
        let mut db = self.db.lock().await;
        let mut record = OwnerRecord::get_by_cognito_subject(&mut *db, cognito_subject)
            .await
            .expect("owner for display name update");
        record
            .update()
            .display_name(display_name)
            .exec(&mut *db)
            .await
            .expect("owner display name update");
        // Reload to get updated_at
        let record = OwnerRecord::get_by_cognito_subject(&mut *db, cognito_subject)
            .await
            .expect("owner reload");
        to_owner(record)
    }
}
