# API feature module migration specification review

- status: `ready`
- active release: R1（散歩記録の縦切り）
- purpose: `apps/api`を公開HTTP契約を維持したままfeature-first構成へ移行する。
- next permitted action: `design`

## Current-release deliverables

- Public health and OpenAPI endpoints continue to return the current method, path, status, response body, and request ID header.
- Public auth endpoints continue to provide Sign Up, Sign In, and their OTP verification flows at the four current `/v1/auth` paths.
- Auth requests continue to accept the current email, username, session, and code shapes; responses continue to provide the current challenge, authentication token, Owner, and error shapes.
- Authentication verification continues to resolve one Owner from the Cognito ID-token subject and returns the persisted Owner timestamps in ISO format.
- Request ID, secure headers, structured request logging, Sentry correlation, validation errors, not-found responses, and uncaught-error responses continue to provide their current observable contracts.
- The source tree provides feature modules under `src/modules`, concrete integrations under `src/infrastructure`, shared HTTP contracts under `src/shared`, and dependency assembly through `app.ts` and `index.ts`.

## Source map

| Source | Supporting section or path | Supported conclusion |
| --- | --- | --- |
| `docs/development/staged-development.md` | 進捗状況、R1 縦切りと未完了 R0 前提、R1、公開インターフェース、検証 | R1アカウント縦切りとHono/OpenAPI/PostgreSQL/Cognito基盤が現在のrelease contextである。 |
| `docs/specs/2026-07-26-hono-api-r0-design.md` | 構成、HTTP API、PostgreSQL、観測性、コード品質 | Hono/OpenAPI、共通error、request ID、Owner一意性、Drizzle、observability、quality gateが移行後も提供する契約である。 |
| `docs/specs/2026-07-27-r0-api-foundation-first-unit.md` | 公開インターフェース、リクエストID、実行と検証 | `/health`、`/openapi.json`、404/500 error、request IDの観測可能な状態を維持する。 |
| `docs/specs/2026-08-11-api-feature-module-architecture-design.md` | 構成、責務、依存方向、Route module、テスト構成、移行条件 | `modules`、`infrastructure`、`shared`、composition rootへの配置とPR2の受け入れ条件を定義する。 |
| `docs/logs/20260811173118-api-feature-module-skills/specification-review.md` | 現在リリースの提供能力、Decision classifications、Gaps checked | feature-first移行はR1の提供能力とrelease順序を維持するimplementation-local changeである。 |
| `docs/logs/20260811173118-api-feature-module-skills/retrospective.md` | Applied during PR #45、Implementation evidence | PR2の前提となるarchitecture/skill review findingsは対応済みである。 |
| `apps/api/src/app.ts`、`apps/api/src/routes/*.ts`、`apps/api/src/auth/contracts.ts` | Current HTTP implementation | health、OpenAPI、4 auth endpoints、request/response/error schemasの現行契約を提供する。 |
| `apps/api/src/auth/owner.ts`、`apps/api/src/schema/owner.ts`、`apps/api/drizzle.config.ts` | Current Owner persistence | Cognito subjectによるOwner解決、Owner DTO、Drizzle schema sourceを提供する。 |
| `apps/api/test/*.test.ts`、`apps/api/package.json` | Current verification | 45件のunit/contract testsと`npm test`、`npm run check`を移行baselineとして提供する。 |

## Decision classifications

### Plan-level

- R1のrelease順序、提供能力、公開interface、検証条件は現行staged planを継続する。

### Implementation-local

- Source and test placement follows the approved feature-first architecture.
- Route handlers delegate feature sequencing to module use cases through module-owned provider and repository interfaces.
- Infrastructure adapters convert Cognito and Drizzle representations into module results.
- Test discovery includes nested `*.test.ts` files, while `*.integration.ts` remains on the separate integration command.

### Deferred release decisions

- PR3 aligns lower-level Hono, Zod, Drizzle, and Cognito technical skills after this migration.
- TrackPoint retry limits remain the R1 TrackPoint start decision.
- Walk and Owner deletion, retention periods, and legal-document URLs remain R3 start decisions.

## Verification conditions

| Command or check | Acceptance condition |
| --- | --- |
| Baseline `npm test` | The current 45 named tests pass before production relocation. |
| Migrated `npm test` | The same 45 named behaviors pass from nested module and infrastructure suites, followed by added boundary coverage. |
| OpenAPI contract comparison | Health and four auth operations retain method, path, request schema, success/error statuses, and response schemas. |
| `npm run check` | ESLint, jscpd, knip, and TypeScript complete successfully. |
| `scripts/agent-skills.sh check` | Canonical skills and categorized references remain consistent because implementation consumes the merged skills. |

## Gaps checked

- Release boundary: this migration supports the active R1 account vertical and preserves the R2/R3 capability boundaries.
- Product preconditions: Cognito API verification, mobile auth state, typed mobile API client, durable outbound queue, iOS location permission, and server-side SQS remain distinct staged-plan prerequisites.
- Delivered evidence: Hono/OpenAPI routes, Drizzle Owner schema/client, Cognito calls, observability middleware, package scripts, and all 45 test declarations exist at the recorded repository paths.
- Public contract: health, OpenAPI, four auth paths, authentication response, shared error shape, request ID behavior, and Owner resolution have implementation and test evidence.
- Architecture coverage: the approved PR2 design provides module, infrastructure, shared, composition, route, test, and migration conditions.
- Plan table: this work preserves every existing R1 prerequisite-table cell and introduces no prerequisite-table change.
