# Verification

## Baseline

- `apps/api npm test`: 45 tests passed before PR1.
- `apps/api npm run check`: passed before PR1.
- `scripts/agent-skills.sh check`: passed before PR1.

## Skill scenarios

Each skill records its baseline observation, forward-test observation, and validator result here as its task completes.

## Architecture contract

- The design defines module, infrastructure, shared, and composition-root responsibilities.
- The dependency direction keeps use cases independent of Hono, AWS SDK, Drizzle, and infrastructure implementations.
- PR2 preserves the public HTTP contract and maps the 45 baseline tests into module and infrastructure suites.
- `git diff --check` passed after the architecture documents were created.

### organizing-api-feature-modules

- Baseline prompt: place a Dogs feature with Hono GET/POST routes, PostgreSQL persistence, and a later S3 adapter.
- Baseline observation: the independent agent chose `src/features/dogs/{domain,application,http,infrastructure}` and placed Drizzle and S3 implementations inside the feature. The dependency direction was sound, but the proposed first-level classifications and concrete adapter placement did not match the approved architecture.
- Forward-test observation: with the skill, the independent agent placed contracts, types, interfaces, routes, and use cases in `src/modules/dogs`; Drizzle schema/repository and S3 adapter in `src/infrastructure`; wiring in `src/index.ts`; route mounting in `src/app.ts`; and mirrored module/infrastructure/composition tests. It explicitly kept Hono, Drizzle, AWS SDK, and infrastructure imports out of use cases.
- Validator: `Skill is valid!`
- Library: `backend/architecture/organizing-api-feature-modules`; sync and check passed.

### routing-hono-apis

- Baseline prompt: plan `POST /v1/auth/sign-in/verify` with exact endpoint naming, aggregation, contract, use case boundary, Owner resolution, persistence, and tests.
- Baseline observation: the existing skill defined method/path and Hono concerns but did not define feature-first placement, exact aggregation names, or use-case/repository boundaries. The independent agent had to infer `features/auth` and `createAuthRoutes` from the repository.
- Forward-test observation: the integrated skill produced `modules/auth/routes/sign-in-verify.ts`, `signInVerifyRoute`, `registerSignInVerifyRoute`, `registerAuthRoutes`, module contracts and use case placement, infrastructure Cognito/Drizzle placement, one `app.route()` mount, and route/OpenAPI tests. It kept token parsing, Owner resolution, and persistence out of the handler.
- Official review: Hono Application, Routing, Context, HonoRequest, HTTPException, Best Practices, and Testing guidance were checked before editing.
- Validator: `Skill is valid!`
- Library: the `backend/hono/organizing-hono-route-modules` link was removed; sync and check passed.

### documenting-hono-openapi

- Baseline prompt: define GET/POST Dogs OpenAPI contracts with exact placement, runtime linkage, shared errors, responses, and verification.
- Baseline observation: the agent inferred the target feature-first placement from repository context and explicitly reported that the existing skill could not determine module placement or route naming by itself.
- Forward-test observation: the updated skill directly produced `modules/dogs/contracts.ts`, endpoint route modules, `shared/http/error-contract.ts`, and `app.ts` metadata/security placement. It reused one schema for OpenAPI and runtime validation, declared only implemented statuses, preserved stable component names, and separated Zod shape, routing, middleware, persistence, and test responsibilities.
- Official review: Hono Zod OpenAPI example and third-party OpenAPI integration guidance were checked before editing.
- Validator: `Skill is valid!`; skill-library sync and check passed.

### validating-hono-requests

- Baseline prompt: plan Dogs JSON validation, schema/hook placement, use-case input, extension behavior, and tests.
- Baseline observation: the existing skill led the independent agent to a route-local validation hook, leaving room for endpoint-specific hook growth and duplicated response behavior.
- Forward-test observation: the updated skill placed field rules and messages in `modules/dogs/contracts.ts`, reused the schema in the route, passed only normalized values plus Owner identity to the use case, and kept a field-agnostic shared validation hook in `app.ts`. Adding a field changed only the module schema and tests.
- Official review: Hono Validation and validator error-handling guidance were checked before editing.
- Validator: `Skill is valid!`; skill-library sync and check passed.

### implementing-api-use-cases

- Baseline prompt: design verify-sign-in orchestration across Cognito, ID-token parsing, and Owner persistence.
- Baseline observation: the independent agent produced a strong boundary from general design knowledge, so the baseline established the expected minimum rather than a failure. It kept the transaction in the repository and excluded Hono/AWS/Drizzle from the use case.
- Forward-test observation: the new skill reproduced module-local input/result/error types, small provider/parser/repository interfaces, dependency order and short-circuit behavior, repository-owned transaction, route-owned HTTP mapping, and explicit import-boundary tests.
- Validator: `Skill is valid!`
- Library: `backend/architecture/implementing-api-use-cases`; sync and check passed.

### implementing-drizzle-repositories

- Baseline prompt: design race-safe Owner find-or-create with exact placement, mapping, transaction, constraint, errors, and tests.
- Baseline observation: the independent agent produced the target repository boundary from general Drizzle knowledge, establishing the forward-test minimum.
- Forward-test observation: the new skill reproduced the module interface, infrastructure schema/repository placement, explicit row mapper, targeted `cognitoSubject` conflict, repository-owned transaction, unchanged existing row, unexpected failure propagation, and real-PostgreSQL concurrency tests.
- Validator: `Skill is valid!`
- Library: `data/drizzle/implementing-drizzle-repositories`; sync and check passed.

### integrating-api-adapters

- Baseline prompt: design a Cognito SignInProvider adapter with command/result/error conversion, injection, lifecycle, and tests.
- Baseline observation: the independent agent produced the target adapter boundary and also exposed current route-level AWS responsibilities, establishing a strong minimum.
- Forward-test observation: the new skill produced an AWS-free module port, exact command conversion, required-token validation, documented SDK exception mapping with `instanceof`, unknown-error identity propagation, injected long-lived client/config, composition-owned shutdown, and adapter-focused tests. It kept JWT subject parsing as a separate capability and route/use-case responsibilities outside the adapter.
- Validator: `Skill is valid!`
- Library: `backend/architecture/integrating-api-adapters`; sync and check passed.

### composing-api-dependencies

- Baseline prompt: compose config, shared Cognito/DB resources, adapters, repository, use case, auth routes, app, server, and shutdown.
- Baseline observation: the independent agent produced sound object-graph and lifecycle guidance but introduced `features/` and a separate `composition.ts`, differing from the approved first-level structure.
- First forward-test observation: construction order and shutdown were correct, but it placed concrete infrastructure inside the auth module. The skill was tightened to preserve the top-level classification.
- Final forward-test observation: all concrete Cognito/Drizzle/config code stayed under `src/infrastructure`, auth interfaces/use cases/routes stayed under `src/modules/auth`, `src/index.ts` became the sole production composition root, `app.ts` mounted the completed child once, and `server.ts` owned idempotent shutdown. Tests observed factory order, instance identity, import side effects, route uniqueness, and close order.
- Validator: `Skill is valid!`
- Library: `backend/architecture/composing-api-dependencies`; sync and check passed.

### composing-hono-middleware

- Baseline prompt: design request ID, body limit, logging, Sentry, validation, auth, not-found, and global-error composition with extension scenarios.
- Baseline observation: the existing skill produced a sound stack and general feature separation, while the three separate process skills held the explicit open/closed and error-layer rules.
- Forward-test observation: the integrated skill produced the complete order, typed request/logger/principal context, public/protected route split, fixed shared failure contracts, Sentry/logging behavior, and feature-extension scenarios that require no shared middleware edits. It placed Dog fields in the Dogs contract and auth outcomes in adapter/use case/route layers.
- Validator: `Skill is valid!`
- Absorbed canonical skills removed: `layering-error-responsibilities`, `open-closed-validation`, `separating-cross-cutting-concerns`; duplicate `composing-hono-middleware/SKILL_ja.md` removed.
- Skill-library sync and check passed.

### testing-hono-apis

- Baseline prompt: plan a behavior-preserving migration of the 45-test flat auth suite into feature-first boundaries.
- Baseline observation: the existing skill preserved endpoint contract practices but proposed `features/` and `platform/` test classifications and did not assign all internal boundary suites.
- Forward-test observation: the updated skill placed route/use-case tests under `test/modules/auth`, adapter/repository/observability tests under `test/infrastructure`, and app/OpenAPI/composition/server tests at their assembly boundaries. It used use-case doubles for routes, provider/repository fakes for use cases, recording SDK senders for adapters, and dedicated transaction/integration tests for repositories.
- Discovery: default nested tests use the quoted `test/**/*.test.ts` pattern; integration tests use `test/**/*.integration.ts` in the separate integration command.
- Behavior migration: preserve all 45 baseline test names and assertions before adding boundary coverage, then record the expanded total and compare method/path/status/request/response/OpenAPI.
- Official review: Hono Testing, Testing Helper, and Node.js Test Runner guidance were checked before editing.
- Validator: `Skill is valid!`; skill-library sync and check passed.

## Final checks

- All ten target skill directories passed `quick_validate.py`.
- `scripts/agent-skills.sh sync` and `scripts/agent-skills.sh check` passed.
- The four absorbed skill directories and four duplicate `SKILL_ja.md` files are absent.
- `git diff --check origin/main...HEAD` passed.
- `apps/api npm test` passed: 45 tests, 45 passed, 0 failed.
- `apps/api npm run check` passed: ESLint, jscpd, knip, and TypeScript completed successfully. jscpd reported the existing two route clones and the command exited successfully.
- Net skill-library changes are limited to five additions and four absorbed-skill deletions.
- The worktree is clean after removing the temporary ignored `node_modules` link used to reuse the baseline dependencies.

## Independent review

- The required `crit` executable was unavailable in the environment. The repository's independent reviewer workflow was used as the review gate.
- Initial review: Critical 0, Important 3, Minor 1, verdict `CHANGES REQUESTED`.
- Important fixes:
  - Added PR3 technical-skill alignment conditions to the architecture contract.
  - Rewrote central specification dependencies as affirmative ownership statements.
  - Restored exact 400/401/404/413/500 shared middleware messages.
- Minor fix: added the `*.integration.ts` naming convention and separate integration command to `testing-hono-apis`.
- Post-fix verification: all ten quick validators, skill sync/check, `git diff --check`, API tests 45/45, and `npm run check` passed.
- Re-review: all prior findings resolved; no new Critical or Important findings; `Ready to merge: Yes`; `APPROVED`.
- Publish: branch `agent/api-feature-module-skills-20260811173118` pushed; PR #45 opened against `main`.

## Retrospective follow-up

### explaining-specifications-and-design

- RED scenario: An independent agent received only the prior skill and a synthetic approval surface. The design covered PR2 database migration and stated `use caseはHonoをimportしない` and `moduleはinfrastructureを参照しない`; the plan contained Task 1 architecture, Task 2 PR2 migration, and Task 3 PR3 skill alignment. The agent was asked for the completion audit required by that skill.
- RED observation: The agent rejected approval through the general WHAT/HOW/WHY check, while it did not perform either new audit as a required operation. Its verbatim reasons were `現行スキルにはその対応表を作る明示的な工程・完了条件がありません` and `現行スキルの完了監査項目には含まれていません`.
- GREEN scenario: A fresh independent agent received the updated skill and the same design and plan. It was asked for an explicit Task-to-design traceability audit and affirmative-language audit.
- GREEN observation: The agent mapped Task 1 to missing design/deliverable/acceptance, Task 2 to the PR2 section and deliverable with a missing acceptance condition, and Task 3 to missing design/deliverable/acceptance. It produced affirmative replacements assigning HTTP adaptation to presentation/router, use-case dependencies to domain types and ports, adapter implementation to infrastructure, and injection to the composition root. Its approval result was `Not ready for approval.`
- Validator: `Skill is valid!`; skill-library sync/check and `git diff --check` passed.

### run-dev-session

- RED scenario: An independent agent received only the prior skill and a request to merge and delete two source skills. The supplied source material included trigger conditions, exact literal `Request body exceeds the allowed size.`, `test/**/*.integration.ts`, `register…Route`, project defaults, official references, and validation scenarios. It was asked for the required pre-deletion plan and whether every item had to appear in an absorption inventory and forward-test.
- RED observation: The plan named baseline, forward-test, and validator, while it did not account for the supplied source values. The agent's verbatim reason was `The current skill does not require an absorption inventory mapping source content into target-skill.` It also reported that a passing forward-test could silently omit source categories.
- GREEN scenario: A fresh independent agent received the updated skill and the same consolidation inputs. It was asked to map every item to the target rule or approved replacement and to a forward-test assertion.
- GREEN observation: The agent created entries for trigger, literal, path, command, naming, default, reference, and validation. It mapped the exact 413 literal to an exact-match assertion, the integration glob to a nested-test scope assertion, and `register…Route` to a naming assertion. It required concrete source values for commands, defaults, references, and scenarios before deletion, concluding `現時点の判定は「削除不可」です` and requiring zero unaccounted inventory items.
- Validator: `Skill is valid!`; skill-library sync/check and `git diff --check` passed.

### Follow-up review

- Initial review: Critical 0, Important 1, Minor 1. The verification record needed matched RED/GREEN scenarios, observed behavior, and verbatim baseline reasons; the design approval gate also needed affirmative wording.
- Review response: recorded the complete evidence and changed the gate to `Continue to approval when every Task has all three links.`
- Re-review: both findings resolved; no new Critical or Important findings; `APPROVED`.
