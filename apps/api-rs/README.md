# api-rs (Axum + Toasty)

Rust replacement for `apps/api`, migrated incrementally while preserving the OpenAPI `/v1` contract.

## Status

Phase 1 — Auth + Owners:

- Cognito `AuthProvider` + JWT access-token verifier
- Owner Toasty model/repository (`owners` table) + `GET/PATCH /v1/owner`
- Auth routes under `/v1/auth` with Bearer middleware on sign-out and all owner routes
- Hand-maintained `GET /openapi.json` (title `walk / dog API`, version `0.1.0`)
- Use-case + route contract tests with fake providers

Phase 0 scaffold retained: `GET /health`, worker health stub, Toasty Postgres connect.

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
| `AWS_REGION` | Cognito region |
| `COGNITO_USER_POOL_ID` | Cognito user pool |
| `COGNITO_CLIENT_ID` | Cognito app client |

## Plan

See `docs/development/2026-09-19-rust-api-axum-toasty-plan.md`.
