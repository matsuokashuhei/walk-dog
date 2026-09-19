//! Auth HTTP response mapping.

use serde::Serialize;

use crate::modules::auth::types::{Authentication, CodeDelivery};
use crate::modules::owners::types::Owner;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeDeliveryBody {
    pub destination: String,
    pub attribute: String,
}

impl From<&CodeDelivery> for CodeDeliveryBody {
    fn from(value: &CodeDelivery) -> Self {
        Self {
            destination: value.destination.clone(),
            attribute: value.attribute.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerBody {
    pub owner_id: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&Owner> for OwnerBody {
    fn from(owner: &Owner) -> Self {
        Self {
            owner_id: owner.owner_id.clone(),
            display_name: owner.display_name.clone(),
            avatar_url: owner.avatar_url.clone(),
            created_at: owner.created_at.to_string(),
            updated_at: owner.updated_at.to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthenticationResponse {
    pub request_id: String,
    pub access_token: String,
    pub id_token: String,
    pub refresh_token: String,
    pub owner: OwnerBody,
}

pub fn to_authentication_response(
    request_id: String,
    authentication: &Authentication,
    owner: &Owner,
) -> AuthenticationResponse {
    AuthenticationResponse {
        request_id,
        access_token: authentication.access_token.clone(),
        id_token: authentication.id_token.clone(),
        refresh_token: authentication.refresh_token.clone(),
        owner: OwnerBody::from(owner),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallengeResponse {
    pub request_id: String,
    pub username: String,
    pub session: Option<String>,
    pub code_delivery: Option<CodeDeliveryBody>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInChallengeResponse {
    pub request_id: String,
    pub username: String,
    pub session: String,
    pub code_delivery: CodeDeliveryBody,
}
