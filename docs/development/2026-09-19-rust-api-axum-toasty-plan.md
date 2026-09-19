# Rust Backend Migration Plan (Axum + Toasty)

> **For agentic workers:** Use `subagent-driven-development` or `executing-plans` task-by-task. Steps use checkbox syntax.

**Goal:** Replace the Node.js / Hono API in `apps/api` with a Rust service that preserves the OpenAPI `/v1` contract so Expo clients keep working.

**Architecture:** Introduce `apps/api-rs` beside the existing TypeScript API. Port modules in release order (health → auth → owners → dogs → walks → worker). Cut over Compose / Docker / ECR when contract tests pass for the migrated surface. Leave mobile and infra Terraform out of scope unless cutover requires image name changes.

**Tech Stack:** Rust (stable ≥ 1.95), Axum, Toasty 0.10 (`postgresql`), tokio, serde, utoipa (OpenAPI), aws-sdk / jsonwebtoken for Cognito, aws-sdk for SQS and DynamoDB, tracing + optional Sentry.

**Spec sources:** `docs/development/staged-development.md`, `docs/specs/2026-07-26-hono-api-r0-design.md`, `docs/specs/2026-08-11-api-feature-module-architecture-design.md`, current OpenAPI at `GET /openapi.json`.

## Global Constraints

- Preserve HTTP contracts: paths, status codes, error body `{ code, message, requestId, retryable }`, Bearer auth, `X-Request-Id`.
- Prefer required injection at composition boundaries (no silent no-op collaborators).
- Incremental replace of the API surface only; do not rewrite Expo or unrelated packages in the same change set.
- OpenAPI remains the public contract source of truth for clients.
- Plan-level stack change: staged plan currently records Hono for R0; sync that document when Axum + Toasty is accepted as the new API runtime.

---

## WHAT (deliverables)

1. Rust HTTP API binary that serves the same `/health`, `/openapi.json`, and `/v1/*` routes the TypeScript API serves today.
2. Rust SQS worker binary that confirms TrackPoints into DynamoDB and exposes worker `GET /health`.
3. Toasty models + migrations for PostgreSQL tables currently owned by Drizzle (`owners`, dogs, goals, walks, participants, events, track-point accept rows, command keys).
4. Contract / unit tests that lock success, auth, validation, conflict, and retryable error behavior.
5. Compose / Dockerfile path to run the Rust API + worker in place of the Node image when ready.

## HOW (phases)

### Phase 0 — Spec sync and scaffold

- [x] Record plan-level judgment: API runtime becomes Axum + Toasty on PostgreSQL (sync `staged-development.md`).
- [x] Create `apps/api-rs` Cargo package (binaries: `api`, `worker`).
- [x] Wire Axum app shell: request ID, structured logging, shared error JSON, `/health` use case with injected postgres + worker pings.
- [x] Add Toasty `Db` connection from the same Postgres env vars the Node API uses.
- [x] `cargo test` green; keep TypeScript `apps/api` in-repo.

### Phase 1 — Auth + Owner (R1 vertical slice 1)

- [x] Port Cognito AuthProvider (sign-up / verify / sign-in / verify / sign-out) behind the same module interfaces.
- [x] Port JWT access-token verifier → `principal.cognitoSubject`.
- [x] Port Owner repository (Toasty) + `GET/PATCH /v1/owner`.
- [x] Contract tests matching existing route tests.

### Phase 2 — Dogs (R1 vertical slice 2)

- [x] Toasty models for Dog + Goal Revision.
- [x] `GET/POST /v1/dogs`, `GET /v1/dogs/{dogId}` with `DOG_NAME_DUPLICATE` / `NOT_FOUND`.

### Phase 3 — Walks core (R1 vertical slices 3–6)

- [x] Active walk, start, finish, delete, track-points accept, events, walk detail.
- [x] Idempotency-Key namespaces and Event `eventId` behavior unchanged.
- [x] SQS enqueue + DynamoDB confirm + finish wait loop (30s timeout) parity.

### Phase 4 — Worker + cutover

- [x] Worker binary parity with `src/worker.ts` (confirm path).
- [x] Dockerfile + compose switch; ECR workflow points at Rust image for api/worker (migrate stays Node/Drizzle via `:migrate` / `MIGRATE_IMAGE`).
- [ ] Remove or archive Node `apps/api` after soak; update mobile only if base URL / OpenAPI generation path changes.

## WHY

The product contracts and R1 vertical slices are stable. Replacing the runtime under the same OpenAPI surface keeps Expo clients and staged delivery intact while moving the API to Axum + Toasty for a single Rust service model (HTTP + worker) on PostgreSQL.

## Mapping: TypeScript → Rust

| TypeScript | Rust |
| --- | --- |
| `src/index.ts` composition | `composition` module + explicit `AppState` / factories |
| Hono + `@hono/zod-openapi` | Axum + hand-maintained `/openapi.json` |
| Drizzle + `pg` Pool | Toasty `Db` (`postgresql` feature); Drizzle retained for migrations |
| Zod schemas | serde types + route validation |
| `modules/{auth,owners,dogs,walks,health}` | same module names under `apps/api-rs/src/modules/` |
| Cognito / SQS / DynamoDB adapters | `aws-sdk-*` / JWT verify crates implementing the same provider traits |
| Pino + Sentry | `tracing` (+ optional Sentry later) |

## Out of scope (this migration)

- Expo mobile UI / client generation changes beyond regenerating from the same OpenAPI.
- S3 Avatar (not present in current API).
- R2 history paging / R3 preferences (port only when those land on the TS side or are scheduled next).

## Verification gates

- Unit tests for each use case (TDD).
- Route contract tests for status codes and error `code` values.
- `cargo clippy --all-targets -- -D warnings` with zero warnings (no clippy config silencing).
- Integration tests against Compose Postgres (and ElasticMQ / DynamoDB Local for walks/worker).
- Before full retire of Node: soak Rust image in Compose / VPS.

## Risks / blockers

| Risk | Mitigation |
| --- | --- |
| Toasty MSRV ≥ 1.95 | Pin toolchain via `rust-toolchain.toml` to stable ≥ 1.95. |
| Toasty schema vs existing Drizzle tables | Map models to existing table/column names; Drizzle remains migrate path. |
| OpenAPI drift | Hand-maintained Rust OpenAPI + TS publish step until Rust is oracle. |
| Dual images (Rust runtime + Node migrate) | `RELEASE_IMAGE` vs `MIGRATE_IMAGE` / `:migrate` tag. |
