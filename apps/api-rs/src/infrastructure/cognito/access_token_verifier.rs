//! Cognito access-token verifier (JWKS / access token → cognitoSubject = sub).

use std::sync::Arc;
use std::time::{Duration, Instant};

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::RwLock;

use crate::infrastructure::config::CognitoConfig;
use crate::shared::http::access_token::{AccessTokenVerifier, Principal};

#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Debug, Deserialize)]
struct AccessClaims {
    sub: String,
    token_use: String,
    client_id: String,
}

struct CachedJwks {
    fetched_at: Instant,
    keys: Vec<Jwk>,
}

pub struct CognitoAccessTokenVerifier {
    user_pool_id: String,
    client_id: String,
    issuer: String,
    jwks_url: String,
    http: reqwest::Client,
    cache: RwLock<Option<CachedJwks>>,
}

impl CognitoAccessTokenVerifier {
    pub fn from_config(config: &CognitoConfig) -> Self {
        let issuer = format!(
            "https://cognito-idp.{}.amazonaws.com/{}",
            config.region, config.user_pool_id
        );
        Self {
            user_pool_id: config.user_pool_id.clone(),
            client_id: config.client_id.clone(),
            issuer: issuer.clone(),
            jwks_url: format!("{issuer}/.well-known/jwks.json"),
            http: reqwest::Client::new(),
            cache: RwLock::new(None),
        }
    }

    async fn jwks(&self) -> Result<Vec<Jwk>, ()> {
        {
            let guard = self.cache.read().await;
            if let Some(cached) = guard.as_ref() {
                if cached.fetched_at.elapsed() < Duration::from_secs(3600) {
                    return Ok(cached.keys.clone());
                }
            }
        }
        let response = self.http.get(&self.jwks_url).send().await.map_err(|_| ())?;
        if !response.status().is_success() {
            return Err(());
        }
        let jwks: Jwks = response.json().await.map_err(|_| ())?;
        let mut guard = self.cache.write().await;
        *guard = Some(CachedJwks {
            fetched_at: Instant::now(),
            keys: jwks.keys.clone(),
        });
        Ok(jwks.keys)
    }
}

#[async_trait::async_trait]
impl AccessTokenVerifier for CognitoAccessTokenVerifier {
    async fn verify(&self, access_token: &str) -> Result<Principal, ()> {
        let header = decode_header(access_token).map_err(|_| ())?;
        let kid = header.kid.ok_or(())?;
        let keys = self.jwks().await?;
        let jwk = keys.into_iter().find(|k| k.kid == kid).ok_or(())?;
        let decoding_key =
            DecodingKey::from_rsa_components(&jwk.n, &jwk.e).map_err(|_| ())?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&self.issuer]);
        validation.validate_aud = false;

        let token_data =
            decode::<AccessClaims>(access_token, &decoding_key, &validation).map_err(|_| ())?;
        if token_data.claims.token_use != "access" {
            return Err(());
        }
        if token_data.claims.client_id != self.client_id {
            return Err(());
        }

        Ok(Principal {
            cognito_subject: token_data.claims.sub,
        })
    }
}

pub type SharedAccessTokenVerifier = Arc<dyn AccessTokenVerifier>;
