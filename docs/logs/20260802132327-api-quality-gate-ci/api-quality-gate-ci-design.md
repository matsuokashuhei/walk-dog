# Design: API quality gate CI

## Purpose

Run the existing `apps/api` static gates on Pull Requests and on `main`, matching follow-up #1 and the continuous-delivery quality-gate slice of the R0 Hono API design.

## What the gates are

`apps/api` defines four gate scripts and a local sequential convenience script:

```text
check = lint && jscpd && knip && typecheck   # local only
```

| Gate | Command | Provides |
| --- | --- | --- |
| lint | `npm run lint` | ESLint + SonarJS + TypeScript strict type-aware rules (size, complexity, unsafe any, floating promises, import cycles) |
| jscpd | `npm run jscpd` | Duplicate detection over `src` TypeScript |
| knip | `npm run knip` | Unused export / file / dependency / import detection |
| typecheck | `npm run typecheck` | `tsc --noEmit` |

CI runs the four gates as **parallel jobs**. Local `npm run check` remains the sequential convenience script and is not invoked by Actions. Gates do **not** include `npm test`, E2E, Docker build, or ECR publish.

## Scope

In scope:

- `.github/workflows/api-check.yml` — reusable workflow (`workflow_call`) with parallel matrix jobs `lint` / `jscpd` / `knip` / `typecheck`
- `.github/workflows/pull-request.yml` — calls `api-check` on `pull_request`
- `.github/workflows/publish.yml` — calls `api-check` on push to `main` (display name `publish`)
- Mark follow-up #1 complete in `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md`

Out of scope (deferred):

- E2E / Compose services in CI
- Docker image build
- jscpd SARIF → Code Scanning
- ECR OIDC publish, release manifest, Sentry release
- `npm test` as a separate CI step

## Workflow shape

```text
pull-request.yml ──┐
                   ├──► api-check.yml ──► lint | jscpd | knip | typecheck (parallel)
publish.yml ───────┘
```

Each matrix job:

1. `actions/checkout` (pinned by full commit SHA)
2. `actions/setup-node` with Node 24 and `cache: npm`, `cache-dependency-path: apps/api/package-lock.json`
3. `npm ci` with `working-directory: apps/api`
4. `npm run <gate>` with `working-directory: apps/api`

Job display names are the gate names (`lint`, `jscpd`, `knip`, `typecheck`). Caller job id is `check`.

PR path filter: `apps/api/**`, `.github/workflows/pull-request.yml`, `.github/workflows/api-check.yml`.

Publish workflow runs on every push to `main` without a path filter.

## External actions

Pin `actions/checkout` and `actions/setup-node` to full commit SHAs (immutable), consistent with the R0 delivery decision to record external actions by commit SHA.

## Follow-up document update

Move item 1 into a Completed section and leave items 2–5 as remaining follow-ups. Item 2’s start condition (“GitHub Actions runs the API static gate”) becomes satisfied after this session merges.

## Verification

- Local: `cd apps/api && npm run check`
- Static review of YAML: reusable `workflow_call`, parallel matrix gates, Node 24, callers `pull-request` / `publish`
- Post-merge / on PR: confirm four parallel gate jobs run on GitHub Actions
