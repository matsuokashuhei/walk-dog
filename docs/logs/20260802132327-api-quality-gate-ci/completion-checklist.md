# Completion checklist

## Deliverables

- [x] `.github/workflows/pull-request.yml` — PR path-filtered API quality gate
- [x] `.github/workflows/main-publish.yml` — main push API quality gate (check only; no ECR yet)
- [x] Follow-up #1 marked completed in `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md`
- [x] `docs/development/staged-development.md` progress notes Actions gate as introduced

## Gate under test

`npm run check` = lint → jscpd → knip → typecheck (no test / E2E / Docker / ECR)

## Verification

- [x] Local `npm ci` + `npm run check` in `apps/api` succeeded
- [x] Both workflows use Node 24, `working-directory: apps/api`, SHA-pinned checkout/setup-node, `npm ci`, `npm run check`
- [ ] Post-merge GitHub Actions run (after publish)
- [x] Crit skipped (tool unavailable); publish proceeds without Crit comments
