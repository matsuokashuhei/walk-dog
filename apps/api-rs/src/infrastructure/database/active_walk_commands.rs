//! Fail recording walks for an owner — SQL parity with Drizzle `failIfPresent`.

use crate::modules::walks::ActiveWalkCommands;

pub struct SqlActiveWalkCommands {
    database_url: String,
}

impl SqlActiveWalkCommands {
    pub fn new(database_url: String) -> Self {
        Self { database_url }
    }
}

#[async_trait::async_trait]
impl ActiveWalkCommands for SqlActiveWalkCommands {
    async fn fail_if_present(&self, owner_id: &str) {
        let owner_uuid: uuid::Uuid = owner_id.parse().expect("owner_id uuid");
        let (client, connection) =
            tokio_postgres::connect(&self.database_url, tokio_postgres::NoTls)
                .await
                .expect("active walk commands connect");
        tokio::spawn(async move {
            let _ = connection.await;
        });
        client
            .execute(
                "UPDATE walks SET state = 'failed' WHERE owner_id = $1 AND state = 'recording'",
                &[&owner_uuid],
            )
            .await
            .expect("fail active walks");
    }
}
