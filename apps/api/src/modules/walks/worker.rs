//! SQS worker loop — confirm TrackPoints then delete messages.

use aws_sdk_sqs::Client as SqsClient;
use tracing::error;

use crate::modules::walks::provider::ConfirmTrackPoint;
use crate::modules::walks::track_point_message::parse_track_point_message;

pub struct ProcessSqsMessagesInput<'a> {
    pub sqs: &'a SqsClient,
    pub queue_url: &'a str,
    pub confirm: &'a dyn ConfirmTrackPoint,
    pub should_continue: &'a dyn Fn() -> bool,
}

pub async fn process_sqs_messages(input: ProcessSqsMessagesInput<'_>) {
    while (input.should_continue)() {
        let output = match input
            .sqs
            .receive_message()
            .queue_url(input.queue_url)
            .wait_time_seconds(20)
            .max_number_of_messages(1)
            .send()
            .await
        {
            Ok(output) => output,
            Err(err) => {
                error!(error = %err, "failed to receive track point messages");
                continue;
            }
        };
        let Some(message) = output.messages.and_then(|mut msgs| msgs.pop()) else {
            continue;
        };
        handle_queue_message(input.sqs, input.queue_url, input.confirm, message).await;
    }
}

async fn handle_queue_message(
    sqs: &SqsClient,
    queue_url: &str,
    confirm: &dyn ConfirmTrackPoint,
    message: aws_sdk_sqs::types::Message,
) {
    let body = message.body.as_deref().unwrap_or("");
    let track_point = match parse_track_point_message(body) {
        Ok(point) => point,
        Err(err) => {
            error!(error = %err, "invalid track point message");
            return;
        }
    };
    if let Err(()) = confirm.confirm(&track_point).await {
        error!("failed to confirm track point");
        return;
    }
    let Some(receipt_handle) = message.receipt_handle else {
        return;
    };
    if let Err(err) = sqs
        .delete_message()
        .queue_url(queue_url)
        .receipt_handle(receipt_handle)
        .send()
        .await
    {
        error!(error = %err, "failed to delete track point message");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::walks::track_point_message::to_track_point_message;
    use crate::modules::walks::types::TrackPoint;
    use std::sync::Mutex;

    struct FakeConfirm {
        confirmed: Mutex<Vec<TrackPoint>>,
        fail: Mutex<bool>,
    }

    #[async_trait::async_trait]
    impl ConfirmTrackPoint for FakeConfirm {
        async fn confirm(&self, track_point: &TrackPoint) -> Result<(), ()> {
            if *self.fail.lock().unwrap() {
                return Err(());
            }
            self.confirmed.lock().unwrap().push(track_point.clone());
            Ok(())
        }
    }

    #[test]
    fn parse_then_confirm_path_with_fake() {
        let point = TrackPoint {
            track_point_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e90".into(),
            walk_id: "0193f0c2-8d4a-7b21-9c55-1a2b3c4d5e80".into(),
            recorded_at: "2026-08-17T12:00:00Z".parse().unwrap(),
            latitude: 35.681_236,
            longitude: 139.767_125,
        };
        let body = to_track_point_message(&point);
        let parsed = parse_track_point_message(&body).unwrap();
        let confirm = FakeConfirm {
            confirmed: Mutex::new(vec![]),
            fail: Mutex::new(false),
        };
        // Sync path covering parse + confirm success used by the worker.
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            confirm.confirm(&parsed).await.unwrap();
        });
        assert_eq!(confirm.confirmed.lock().unwrap().len(), 1);
        assert_eq!(
            confirm.confirmed.lock().unwrap()[0].track_point_id,
            point.track_point_id
        );
    }
}
