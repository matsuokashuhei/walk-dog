//! Environment configuration — fail fast at the boundary.

use std::env;

#[derive(Debug, Clone)]
pub struct PostgresConfig {
    pub user: String,
    pub password: String,
    pub db: String,
    pub host: String,
    pub port: u16,
    pub pool_max: u32,
}

impl PostgresConfig {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            user: required("POSTGRES_USER")?,
            password: required("POSTGRES_PASSWORD")?,
            db: required("POSTGRES_DB")?,
            host: required("POSTGRES_HOST")?,
            port: parse_u16("POSTGRES_PORT")?,
            pool_max: env::var("DATABASE_POOL_MAX")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| {
                    s.parse::<u32>()
                        .map_err(|_| "DATABASE_POOL_MAX must be a positive integer".to_string())
                })
                .transpose()?
                .unwrap_or(10),
        })
    }

    pub fn connection_url(&self) -> String {
        format!(
            "postgresql://{}:{}@{}:{}/{}",
            urlencoding_simple(&self.user),
            urlencoding_simple(&self.password),
            self.host,
            self.port,
            self.db
        )
    }
}

#[derive(Debug, Clone)]
pub struct CognitoConfig {
    pub region: String,
    pub user_pool_id: String,
    pub client_id: String,
}

impl CognitoConfig {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            region: required("AWS_REGION")?,
            user_pool_id: required("COGNITO_USER_POOL_ID")?,
            client_id: required("COGNITO_CLIENT_ID")?,
        })
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub postgres: PostgresConfig,
    pub cognito: CognitoConfig,
    pub worker_health_url: String,
    pub listen_addr: String,
    pub environment: String,
    pub release: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            postgres: PostgresConfig::from_env()?,
            cognito: CognitoConfig::from_env()?,
            worker_health_url: required("WORKER_HEALTH_URL")?,
            listen_addr: env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:3000".to_string()),
            environment: required("ENVIRONMENT")?,
            release: required("RELEASE")?,
        })
    }
}

fn required(key: &str) -> Result<String, String> {
    env::var(key)
        .map_err(|_| format!("{key} is required"))
        .and_then(|v| {
            if v.is_empty() {
                Err(format!("{key} is required"))
            } else {
                Ok(v)
            }
        })
}

fn parse_u16(key: &str) -> Result<u16, String> {
    required(key)?
        .parse()
        .map_err(|_| format!("{key} must be a u16"))
}

fn urlencoding_simple(value: &str) -> String {
    // Enough for local compose credentials; production secrets should avoid reserved chars
    // or we switch to percent-encoding crate later.
    value
        .chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn postgres_connection_url_encodes_password() {
        let cfg = PostgresConfig {
            user: "walk".into(),
            password: "p@ss".into(),
            db: "walk".into(),
            host: "localhost".into(),
            port: 5432,
            pool_max: 10,
        };
        assert_eq!(
            cfg.connection_url(),
            "postgresql://walk:p%40ss@localhost:5432/walk"
        );
    }

    #[test]
    fn from_env_requires_postgres_user() {
        let _guard = env_lock().lock().unwrap();
        // SAFETY: serialized by env_lock for this test process.
        unsafe {
            env::remove_var("POSTGRES_USER");
            env::set_var("POSTGRES_PASSWORD", "x");
            env::set_var("POSTGRES_DB", "x");
            env::set_var("POSTGRES_HOST", "localhost");
            env::set_var("POSTGRES_PORT", "5432");
        }
        let err = PostgresConfig::from_env().unwrap_err();
        assert!(err.contains("POSTGRES_USER"));
    }
}
