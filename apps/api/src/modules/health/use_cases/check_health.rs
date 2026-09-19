//! Health check use case — mirrors TypeScript `createCheckHealth`.

use std::future::Future;
use std::pin::Pin;

pub type BoxFut<'a> = Pin<Box<dyn Future<Output = Result<(), ()>> + Send + 'a>>;

pub trait HealthPings: Send + Sync {
    fn ping_postgres(&self) -> BoxFut<'_>;
    fn ping_worker(&self) -> BoxFut<'_>;
}

pub async fn check_health(pings: &(impl HealthPings + ?Sized)) -> HealthStatus {
    let postgres = pings.ping_postgres();
    let worker = pings.ping_worker();
    match tokio::try_join!(postgres, worker) {
        Ok(((), ())) => HealthStatus::Ok,
        Err(()) => HealthStatus::Unavailable,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthStatus {
    Ok,
    Unavailable,
}

#[cfg(test)]
mod tests {
    use super::*;

    struct OkPings;

    impl HealthPings for OkPings {
        fn ping_postgres(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }

        fn ping_worker(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }
    }

    struct WorkerDown;

    impl HealthPings for WorkerDown {
        fn ping_postgres(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }

        fn ping_worker(&self) -> BoxFut<'_> {
            Box::pin(async { Err(()) })
        }
    }

    struct PostgresDown;

    impl HealthPings for PostgresDown {
        fn ping_postgres(&self) -> BoxFut<'_> {
            Box::pin(async { Err(()) })
        }

        fn ping_worker(&self) -> BoxFut<'_> {
            Box::pin(async { Ok(()) })
        }
    }

    #[tokio::test]
    async fn ok_when_postgres_and_worker_succeed() {
        assert_eq!(check_health(&OkPings).await, HealthStatus::Ok);
    }

    #[tokio::test]
    async fn unavailable_when_worker_fails() {
        assert_eq!(check_health(&WorkerDown).await, HealthStatus::Unavailable);
    }

    #[tokio::test]
    async fn unavailable_when_postgres_fails() {
        assert_eq!(
            check_health(&PostgresDown).await,
            HealthStatus::Unavailable
        );
    }
}
