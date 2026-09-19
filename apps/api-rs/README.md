# api-rs (Axum + Toasty)

Rust replacement for `apps/api`, migrated incrementally while preserving the OpenAPI `/v1` contract.

## Status

Walks surface (active / start / delete / finish / track-points / events / detail) and worker confirmation path are ported. Compose and ECR publish run this package for `api` and `worker`.

- Cognito `AuthProvider` + JWT access-token verifier
- Owner / dogs / walks Toasty repositories
- Auth, owner, dogs, walks routes under `/v1` with Bearer middleware
- Hand-maintained `GET /openapi.json` (title `walk / dog API`, version `0.1.0`)
- Use-case + route contract tests with fake providers

`apps/api` (TypeScript) remains in-repo for Drizzle migrations and as the OpenAPI source used by the publish manifest until Rust OpenAPI is authoritative.

## Develop

```bash
cd apps/api-rs
cargo test
cargo run --bin api    # requires env from apps/.env.example
cargo run --bin worker
```

Toolchain: `rust-toolchain.toml` pins Rust ≥ 1.95 (Toasty MSRV).

## Docker / Compose

- `Dockerfile` builds release `api` and `worker` binaries (default CMD `api`; override command to `worker`).
- Local `apps/compose.yml`: `api` and `worker` build from `./api-rs`. Run migrations with the optional profile or the TS package:
  - `docker compose --profile migrate run --rm migrate`
  - or `(cd apps/api && npm run migrate)` against compose Postgres
- VPS `apps/compose.vps.yml`: `api` / `worker` use `${RELEASE_IMAGE}` (Rust). `migrate` uses `${MIGRATE_IMAGE}` (Node/Drizzle, ECR tag `:migrate`).
- Publish workflow pushes Rust as `:latest` / `:${sha}` and Node runtime as `:migrate` / `:migrate-${sha}`.

## Env

Same Postgres and worker health variables as `apps/api`, plus:

| Variable | Notes |
| --- | --- |
| `LISTEN_ADDR` | default `0.0.0.0:3000` |
| `ENVIRONMENT`, `RELEASE` | required (observability) |
| `WORKER_HEALTH_URL` | API health dependency |
| `WORKER_HEALTH_PORT` | worker health listen port (default 3001) |
| `AWS_REGION` | Cognito region |
| `COGNITO_USER_POOL_ID` | Cognito user pool |
| `COGNITO_CLIENT_ID` | Cognito app client |

## Plan

See `docs/development/2026-09-19-rust-api-axum-toasty-plan.md`.
