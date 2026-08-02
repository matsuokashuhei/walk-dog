# Specification review

- status: ready
- purpose: Wire `apps/api` `npm run check` into GitHub Actions for Pull Request and main publish workflows
- active release: R0（開発基盤）
- next permitted action: design

## Confirmed purpose

R0 の継続的提供のうち、既存のローカル静的品質ゲート（`apps/api` の `npm run check`）を Pull Request workflow と main publish workflow で実行する。

## Source map

| Conclusion | Source |
| --- | --- |
| Active release is R0; API quality gate follow-ups are in progress | `docs/development/staged-development.md` §進捗状況 |
| R0 includes ECR publish workflow as a release capability | `docs/development/staged-development.md` §R0: 開発基盤 |
| PR and GitHub Actions run the same `npm run check` as local verification | `docs/specs/2026-07-26-hono-api-r0-design.md` §コード品質 |
| Pull Request workflow runs `npm ci` then `npm run check`; main publish runs the same quality gate | `docs/specs/2026-07-26-hono-api-r0-design.md` §継続的提供 |
| Follow-up #1 deliverable: PR and main publish workflows run `npm ci` then `npm run check` | `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md` §1 |
| Local `npm run check` already exists (lint → jscpd → knip → typecheck) | `apps/api/package.json` scripts; follow-up §Completed |
| No GitHub Actions workflows exist yet | repository `.github/workflows` absent on `origin/main` |
| API image uses Node 24 | `apps/api/Dockerfile` |

## Current-release deliverables

- Pull Request workflow that, for changes affecting the API package path used by the gate, checks out the repository, sets up Node.js 24, runs `npm ci` in `apps/api`, then runs `npm run check`.
- Main publish workflow that, on push to `main`, runs the same `npm ci` then `npm run check` sequence for `apps/api`.
- Follow-up document item 1 marked completed, with remaining items 2–5 unchanged as later work.

## Acceptance conditions

- Opening or updating a pull request that includes API package files causes the PR workflow to execute `npm run check` successfully when the gate passes locally.
- A push to `main` causes the main publish workflow to execute the same `npm run check` sequence.
- Workflow working directory is `apps/api`, matching the package that owns `npm run check`.

## Decision classifications

| Decision | Classification | Notes |
| --- | --- | --- |
| Implement follow-up #1 only: workflows run `npm ci` + `npm run check` | implementation-local | Already recorded as the next deliverable in the follow-up doc; does not change release order or R0 capabilities list |
| Defer E2E in CI, Docker image build in PR, jscpd SARIF upload | deferred | Follow-ups #2 and #3; E2E and Compose deps are not present |
| Defer ECR OIDC push, release manifest, Sentry release on main | deferred | Remaining R0 continuous-delivery work beyond follow-up #1; staged plan still lists ECR as R0 |
| Defer knip entry expansion and mobile static gates | deferred | Follow-ups #4 and #5 |
| Node.js 24 for Actions to match Dockerfile | implementation-local | Aligns CI runtime with `apps/api/Dockerfile` |
| Main workflow name remains “publish” path but ships check-only steps in this session | implementation-local | Matches follow-up wording; ECR steps arrive in a later R0 unit |

## Verification conditions

- `apps/api` `npm run check` continues to pass locally.
- Workflow YAML validates structurally (triggers, Node 24, `working-directory: apps/api`, `npm ci`, `npm run check`).
- After merge, a PR or `main` push exercises the workflow on GitHub Actions.

## Gaps checked

- Required sources exist and agree on follow-up #1 scope.
- No plan-level decision awaits confirmation for this purpose.
- Full design §継続的提供 E2E / ECR steps are intentionally out of this session’s deliverables and already tracked as later work.
