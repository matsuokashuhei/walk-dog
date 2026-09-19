//! SQS TrackPoint queue adapter.

use aws_sdk_sqs::Client as SqsClient;

use crate::infrastructure::config::SqsConfig;
use crate::modules::walks::provider::TrackPointQueue;
use crate::modules::walks::track_point_message::to_track_point_message;
use crate::modules::walks::types::TrackPoint;

pub async fn create_sqs_client(config: &SqsConfig) -> SqsClient {
    let mut loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(aws_config::Region::new(config.region.clone()));
    if let Some(endpoint) = &config.endpoint {
        loader = loader.endpoint_url(endpoint);
    }
    let shared = loader.load().await;
    SqsClient::new(&shared)
}

pub struct SqsTrackPointQueue {
    client: SqsClient,
    queue_url: String,
}

impl SqsTrackPointQueue {
    pub fn new(client: SqsClient, config: &SqsConfig) -> Self {
        Self {
            client,
            queue_url: config.queue_url.clone(),
        }
    }
}

#[async_trait::async_trait]
impl TrackPointQueue for SqsTrackPointQueue {
    async fn enqueue(&self, track_point: &TrackPoint) -> Result<(), ()> {
        let body = to_track_point_message(track_point);
        self.client
            .send_message()
            .queue_url(&self.queue_url)
            .message_body(body)
            .send()
            .await
            .map(|_| ())
            .map_err(|_| ())
    }
}
