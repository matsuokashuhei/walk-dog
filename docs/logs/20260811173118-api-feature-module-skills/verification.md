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

## Final checks

Pending implementation.
