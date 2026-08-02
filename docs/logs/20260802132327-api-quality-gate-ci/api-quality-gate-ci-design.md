# Design: API quality gate CI

## Purpose

Run the existing `apps/api` local static gate (`npm run check`) on Pull Requests and on `main`, matching follow-up #1 and the continuous-delivery quality-gate slice of the R0 Hono API design.

## What `npm run check` is

`apps/api` defines:

```text
check = lint && jscpd && knip && typecheck
```

| Step | Command | Provides |
| --- | --- | --- |
| 1 | `npm run lint` | ESLint + SonarJS + TypeScript strict type-aware rules (size, complexity, unsafe any, floating promises, import cycles) |
| 2 | `npm run jscpd` | Duplicate detection over `src` TypeScript |
| 3 | `npm run knip` | Unused export / file / dependency / import detection |
| 4 | `npm run typecheck` | `tsc --noEmit` |

Any failing step fails the whole gate. Current `check` does **not** run `npm test`, E2E, Docker build, or ECR publish. Those remain separate scripts or later follow-ups.

This session wires that exact existing gate into GitHub Actions; it does not change the gate’s composition.

## Scope

In scope:

- `.github/workflows/pull-request.yml` — on `pull_request`, checkout, Node.js 24, `npm ci`, `npm run check` in `apps/api`
- `.github/workflows/main-publish.yml` — on `push` to `main`, the same sequence
- Mark follow-up #1 complete in `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md`

Out of scope (deferred):

- E2E / Compose services in CI
- Docker image build
- jscpd SARIF → Code Scanning
- ECR OIDC publish, release manifest, Sentry release
- `npm test` as a separate CI step (not part of current `check`)

## Workflow shape

Both workflows share one job, `api-quality-gate`:

1. `actions/checkout` (pinned by full commit SHA)
2. `actions/setup-node` with Node 24 and `cache: npm`, `cache-dependency-path: apps/api/package-lock.json`
3. `npm ci` with `working-directory: apps/api`
4. `npm run check` with `working-directory: apps/api`

PR workflow path filter (optional but preferred): run when `apps/api/**` or the workflow file itself changes, so unrelated mobile-only PRs skip the API gate until a shared monorepo gate exists.

Main publish workflow runs on every push to `main` without a path filter so the default branch always records a gate result.

## External actions

Pin `actions/checkout` and `actions/setup-node` to full commit SHAs (immutable), consistent with the R0 delivery decision to record external actions by commit SHA.

## Follow-up document update

Move item 1 into a Completed section (or mark it completed in place) and leave items 2–5 as remaining follow-ups. Item 2’s start condition (“GitHub Actions runs the API static gate”) becomes satisfied after this session merges.

## Verification

- Local: `cd apps/api && npm run check`
- Static review of YAML: triggers, Node 24, working directory, `npm ci` then `npm run check`
- Post-merge: confirm the workflow runs on GitHub Actions
