# R0 API Observability Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add Pino structured logs and Sentry to the API process, correlated by requestId, with secure headers in the common middleware stack.

**Architecture:** Extend config loading, add observability modules under `apps/api/src/observability/`, inject a logger into `createApp`, and close Sentry during process shutdown.

**Tech Stack:** Hono `secureHeaders`, Pino, `@sentry/node`, Zod, Node test runner.

## Global Constraints

- Preserve existing `/health`, `/openapi.json`, request ID, and error JSON contracts.
- Empty or absent `SENTRY_DSN` disables Sentry.
- Do not add worker process, Owner log fields, body-limit, or CORS in this plan.
- Record official documentation URLs already captured in the design.

---

## Task 1: Observability configuration

**Files:**
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/test/config.test.ts`
- Modify: `apps/.env.example`

- [ ] **Step 1: Write failing config tests for ENVIRONMENT, RELEASE, and SENTRY_DSN**
- [ ] **Step 2: Extend config loaders and env example**
- [ ] **Step 3: Run config tests and confirm they pass**

---

## Task 2: Logger, Sentry, and request middleware

**Files:**
- Create: `apps/api/src/observability/logger.ts`
- Create: `apps/api/src/observability/sentry.ts`
- Create: `apps/api/src/observability/request-middleware.ts`
- Create: `apps/api/test/observability.test.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install `pino` and `@sentry/node`**
- [ ] **Step 2: Write failing observability tests for log fields and Sentry capture**
- [ ] **Step 3: Implement logger, Sentry helpers, and request middleware**
- [ ] **Step 4: Run observability tests and confirm they pass**

---

## Task 3: Wire middleware, app, startup, and shutdown

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/test/app.test.ts`
- Modify: `apps/api/test/server.test.ts`

- [ ] **Step 1: Register secure headers and observability middleware; capture errors in onError**
- [ ] **Step 2: Initialize Sentry and logger at startup; close Sentry on shutdown**
- [ ] **Step 3: Assert secure headers and keep existing contract tests green**
- [ ] **Step 4: Run `npm test` and `npm run build`**

---

## Task 4: Session verification record

**Files:**
- Create: `docs/logs/20260801235416-r0-api-observability/completion-checklist.md`
- Modify: `docs/logs/20260801235416-r0-api-observability/transcript.md`

- [ ] **Step 1: Record verification commands and results**
- [ ] **Step 2: Update the transcript artifact list**
