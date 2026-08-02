# Implementation plan: API quality gate CI

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax for tracking.

## Goal

Add Pull Request and main publish GitHub Actions workflows that run `npm ci` then `npm run check` in `apps/api`, and mark follow-up #1 complete.

## Gate under test

CI executes the current `apps/api` script:

```text
npm run check
  → lint (ESLint + SonarJS + TS strict)
  → jscpd (duplication in src)
  → knip (unused code / deps)
  → typecheck (tsc --noEmit)
```

Not included in `check` today: unit tests, E2E, image build, ECR. Do not expand `check` in this plan.

## Task 1: Pull Request workflow

**Files:**
- Create: `.github/workflows/pull-request.yml`

- [x] Add workflow triggered on `pull_request`
- [x] Job `api-quality-gate`: checkout (SHA-pinned), setup-node 24 with npm cache on `apps/api/package-lock.json`
- [x] `npm ci` then `npm run check` in `apps/api`
- [x] Path filter for `apps/api/**` and `.github/workflows/pull-request.yml`

## Task 2: Main publish workflow

**Files:**
- Create: `.github/workflows/main-publish.yml`

- [x] Add workflow triggered on `push` to `main`
- [x] Same job steps as Task 1 (no path filter)
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
- [x] Confirm both YAML files encode Node 24, `apps/api`, `npm ci`, `npm run check`
- [x] Update session checklist / transcript with verification results

## Constraints

- Do not add E2E, SARIF upload, Docker build, or ECR publish in this plan
- Do not change `apps/api` gate scripts unless a workflow requirement forces it
- Pin third-party Actions by full commit SHA
