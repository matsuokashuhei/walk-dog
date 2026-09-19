# api (Axum + Toasty)

Primary HTTP API and SQS worker for walk / dog. OpenAPI `/v1` contract parity with the former TypeScript service (`apps/api-ts`).

## Develop

```bash
cd apps/api
cargo test
cargo clippy --all-targets -- -D warnings
cargo run --bin api
cargo run --bin worker
```

Toolchain: `rust-toolchain.toml` pins Rust ≥ 1.95 (Toasty MSRV).

## Migrations

Drizzle migrations remain in `apps/api-ts`:

```bash
cd apps/api-ts && npm run migrate
# or: docker compose --profile migrate run --rm migrate
```

## Compose / ECR

- Local `apps/compose.yml`: `api` and `worker` build from `./api` (this package).
- VPS: `RELEASE_IMAGE` = Rust; `MIGRATE_IMAGE` / `:migrate` = Node (`apps/api-ts`).

## Env

| Variable | Notes |
| --- | --- |
| `LISTEN_ADDR` | default `0.0.0.0:3000` |
| `ENVIRONMENT`, `RELEASE` | required (observability) |
| `WORKER_HEALTH_URL` | API health dependency |
| `WORKER_HEALTH_PORT` | worker health listen port (default 3001) |
| Postgres / Cognito / SQS / DynamoDB | same as former Node API |

See `docs/development/2026-09-19-rust-api-axum-toasty-plan.md`.
