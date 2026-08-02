# Implementation plan: API quality gate CI

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax for tracking.

## Goal

Add Pull Request and publish GitHub Actions workflows that run the four `apps/api` static gates, and mark follow-up #1 complete.

## Gate under test

Local convenience:

```text
npm run check
  → lint && jscpd && knip && typecheck
```

CI (parallel matrix via reusable `api-check.yml`):

```text
lint | jscpd | knip | typecheck
```

Not included: unit tests, E2E, image build, ECR.

## Task 1: Pull Request workflow

**Files:**
- Create: `.github/workflows/pull-request.yml`

- [x] Add workflow triggered on `pull_request`
- [x] Call reusable `api-check.yml` (job id `check`)
- [x] Path filter for `apps/api/**`, `.github/workflows/pull-request.yml`, `.github/workflows/api-check.yml`

## Task 2: Publish workflow

**Files:**
- Create: `.github/workflows/publish.yml` (replaces `main-publish.yml`)

- [x] Add workflow `name: publish` triggered on `push` to `main`
- [x] Call the same reusable `api-check.yml`
- [x] Leave ECR / OIDC / image publish for a later R0 unit

## Task 3: Follow-up document + staged progress

**Files:**
- Modify: `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md`
- Modify: `docs/development/staged-development.md` only if the progress blurb needs to point at remaining follow-ups after #1 completes

- [x] Record follow-up #1 as completed with the workflow paths
- [x] Keep items 2–5 as remaining work
- [x] Confirm staged-development progress link still points at the follow-up doc

## Task 4: Verify

- [x] Run `npm run check` in `apps/api`
- [x] Confirm reusable workflow encodes Node 24, `apps/api`, `npm ci`, per-gate scripts
- [x] Update session checklist / transcript with verification results

## Task 5: PR #22 review response

- [x] Extract gates into `.github/workflows/api-check.yml` with parallel matrix jobs
- [x] Rename workflow display name to `publish`; low-context job names `lint` / `jscpd` / `knip` / `typecheck`
- [x] Thin callers to `uses: ./.github/workflows/api-check.yml`

## Constraints

- Do not add E2E, SARIF upload, Docker build, or ECR publish in this plan
- Do not change `apps/api` gate scripts unless a workflow requirement forces it
- Pin third-party Actions by full commit SHA
