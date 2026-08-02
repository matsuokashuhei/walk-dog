# Completion checklist

## Deliverables

- [x] `.github/workflows/api-check.yml` — reusable parallel gates (`lint` / `jscpd` / `knip` / `typecheck`)
- [x] `.github/workflows/pull-request.yml` — calls `api-check` (path-filtered)
- [x] `.github/workflows/publish.yml` — calls `api-check` on `main` (no ECR yet); replaces `main-publish.yml`
- [x] Follow-up #1 marked completed in `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md`
- [x] `docs/development/staged-development.md` progress notes Actions gate as introduced

## Gate under test

Local: `npm run check` = lint → jscpd → knip → typecheck (sequential convenience)

CI: same four scripts as parallel matrix jobs (no test / E2E / Docker / ECR)

## Verification

- [x] Local `npm ci` + `npm run check` in `apps/api` succeeded
- [x] Reusable workflow uses Node 24, SHA-pinned checkout/setup-node, `npm ci`, per-gate `npm run <gate>`
- [ ] PR / publish Actions show four parallel gate jobs (after review-fix push)
- [x] Crit skipped (tool unavailable); publish proceeds without Crit comments
- [x] PR #22 review comments addressed (parallel gates, `publish` name, low-context job names, reusable workflow)
