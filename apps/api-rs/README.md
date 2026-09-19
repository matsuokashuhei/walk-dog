# api-rs (Axum + Toasty)

Rust replacement for `apps/api`, migrated incrementally while preserving the OpenAPI `/v1` contract.

## Status

Phase 0 scaffold:

- `api` binary — Axum app with `GET /health` (same success / 503 error shape as the Node API)
- `worker` binary — health stub on `WORKER_HEALTH_PORT` (SQS confirm logic not ported yet)
- Toasty connected to PostgreSQL at startup (`postgresql` feature)
- Composition injects required health pings (Postgres `SELECT 1` + worker HTTP)

## Develop

```bash
cd apps/api-rs
cargo test
cargo run --bin api    # requires env from apps/.env.example
cargo run --bin worker
```

Toolchain: `rust-toolchain.toml` pins Rust ≥ 1.95 (Toasty MSRV).

## Env

Same Postgres and worker health variables as `apps/api`, plus:

| Variable | Notes |
| --- | --- |
| `LISTEN_ADDR` | default `0.0.0.0:3000` |
| `ENVIRONMENT`, `RELEASE` | required (observability) |
| `WORKER_HEALTH_URL` | API health dependency |
| `WORKER_HEALTH_PORT` | worker health listen port (default 3001) |

## Plan

See `docs/development/2026-09-19-rust-api-axum-toasty-plan.md`.
