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

## Final checks

Pending implementation.
