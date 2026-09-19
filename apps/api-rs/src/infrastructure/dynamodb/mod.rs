//! DynamoDB confirmed TrackPoint adapter.

use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;

use crate::infrastructure::config::DynamoDbConfig;
use crate::modules::walks::provider::{ConfirmTrackPoint, ConfirmedTrackPoints};
use crate::modules::walks::types::{ConfirmedTrackPoint, TrackPoint};
use crate::shared::time_format::to_iso8601_millis;

pub async fn create_dynamodb_client(config: &DynamoDbConfig) -> DynamoDbClient {
    let mut loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(aws_config::Region::new(config.region.clone()));
    if let Some(endpoint) = &config.endpoint {
        loader = loader.endpoint_url(endpoint);
    }
    let shared = loader.load().await;
    DynamoDbClient::new(&shared)
}

pub struct DynamoConfirmTrackPoint {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoConfirmTrackPoint {
    pub fn new(client: DynamoDbClient, config: &DynamoDbConfig) -> Self {
        Self {
            client,
            table_name: config.table_name.clone(),
        }
    }
}

#[async_trait::async_trait]
impl ConfirmTrackPoint for DynamoConfirmTrackPoint {
    async fn confirm(&self, track_point: &TrackPoint) -> Result<(), ()> {
        let result = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item("walkId", AttributeValue::S(track_point.walk_id.clone()))
            .item(
                "recordedAt",
                AttributeValue::S(to_iso8601_millis(track_point.recorded_at)),
            )
            .item(
                "trackPointId",
                AttributeValue::S(track_point.track_point_id.clone()),
            )
            .item(
                "latitude",
                AttributeValue::N(track_point.latitude.to_string()),
            )
            .item(
                "longitude",
                AttributeValue::N(track_point.longitude.to_string()),
            )
            .condition_expression("attribute_not_exists(walkId)")
            .send()
            .await;

        match result {
            Ok(_) => Ok(()),
            Err(err) => {
                let service = err.into_service_error();
                if service.is_conditional_check_failed_exception() {
                    Ok(())
                } else {
                    Err(())
                }
            }
        }
    }
}

pub struct DynamoConfirmedTrackPoints {
    client: DynamoDbClient,
    table_name: String,
}

impl DynamoConfirmedTrackPoints {
    pub fn new(client: DynamoDbClient, config: &DynamoDbConfig) -> Self {
        Self {
            client,
            table_name: config.table_name.clone(),
        }
    }
}

#[async_trait::async_trait]
impl ConfirmedTrackPoints for DynamoConfirmedTrackPoints {
    async fn list_points(&self, walk_id: &str) -> Result<Vec<ConfirmedTrackPoint>, ()> {
        let mut points = Vec::new();
        let mut exclusive_start_key = None;

        loop {
            let mut request = self
                .client
                .query()
                .table_name(&self.table_name)
                .key_condition_expression("walkId = :walkId")
                .expression_attribute_values(":walkId", AttributeValue::S(walk_id.to_string()));
            if let Some(key) = exclusive_start_key {
                request = request.set_exclusive_start_key(Some(key));
            }
            let response = request.send().await.map_err(|_| ())?;
            for item in response.items.unwrap_or_default() {
                points.push(point_from_item(&item)?);
            }
            exclusive_start_key = response.last_evaluated_key;
            if exclusive_start_key.is_none() {
                break;
            }
        }

        Ok(points)
    }

    async fn list_recorded_at(&self, walk_id: &str) -> Result<Vec<jiff::Timestamp>, ()> {
        let points = self.list_points(walk_id).await?;
        Ok(points.into_iter().map(|point| point.recorded_at).collect())
    }
}

fn point_from_item(
    item: &std::collections::HashMap<String, AttributeValue>,
) -> Result<ConfirmedTrackPoint, ()> {
    let recorded_at = item
        .get("recordedAt")
        .ok_or(())?
        .as_s()
        .map_err(|_| ())?
        .parse::<jiff::Timestamp>()
        .map_err(|_| ())?;
    let latitude = item
        .get("latitude")
        .ok_or(())?
        .as_n()
        .map_err(|_| ())?
        .parse::<f64>()
        .map_err(|_| ())?;
    let longitude = item
        .get("longitude")
        .ok_or(())?
        .as_n()
        .map_err(|_| ())?
        .parse::<f64>()
        .map_err(|_| ())?;
    Ok(ConfirmedTrackPoint {
        recorded_at,
        latitude,
        longitude,
    })
}

pub async fn ensure_track_points_table(
    client: &DynamoDbClient,
    config: &DynamoDbConfig,
) -> Result<(), String> {
    match client
        .describe_table()
        .table_name(&config.table_name)
        .send()
        .await
    {
        Ok(_) => Ok(()),
        Err(err) => {
            let service = err.into_service_error();
            if !service.is_resource_not_found_exception() {
                return Err(format!("describe track points table: {service}"));
            }
            use aws_sdk_dynamodb::types::{
                AttributeDefinition, BillingMode, KeySchemaElement, KeyType, ScalarAttributeType,
            };
            client
                .create_table()
                .table_name(&config.table_name)
                .attribute_definitions(
                    AttributeDefinition::builder()
                        .attribute_name("walkId")
                        .attribute_type(ScalarAttributeType::S)
                        .build()
                        .expect("walkId attribute"),
                )
                .attribute_definitions(
                    AttributeDefinition::builder()
                        .attribute_name("recordedAt")
                        .attribute_type(ScalarAttributeType::S)
                        .build()
                        .expect("recordedAt attribute"),
                )
                .key_schema(
                    KeySchemaElement::builder()
                        .attribute_name("walkId")
                        .key_type(KeyType::Hash)
                        .build()
                        .expect("walkId key"),
                )
                .key_schema(
                    KeySchemaElement::builder()
                        .attribute_name("recordedAt")
                        .key_type(KeyType::Range)
                        .build()
                        .expect("recordedAt key"),
                )
                .billing_mode(BillingMode::PayPerRequest)
                .send()
                .await
                .map_err(|err| format!("create track points table: {err}"))?;
            Ok(())
        }
    }
}
