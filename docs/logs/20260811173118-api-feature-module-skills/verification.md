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

## Final checks

Pending implementation.
