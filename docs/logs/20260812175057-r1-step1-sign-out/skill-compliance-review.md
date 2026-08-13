# Skill-compliance review — Sign Out (`327d0f91`..`a1ddb03`)

- **status:** APPROVED
- **date:** 2026-08-13
- **reviewer:** Senior Code Reviewer (Cursor Grok 4.5)
- **target:** PR https://github.com/matsuokashuhei/walk-dog/pull/49
- **checkout:** `/Users/matsuokashuhei/Development/walk-dog/.worktrees/agent/r1-step1-sign-out-20260812175057`
- **branch:** `agent/r1-step1-sign-out-20260812175057`
- **scope:** `AGENTS.md` + every directory under `.agents/skills/` (59 skills). Diff: `git diff 327d0f91..HEAD` (merge base `327d0f91`, HEAD `a1ddb0337a892666a4f59936cdc29f1516e628a7`).
- **round:** 2 (re-review after Important fixes in `a1ddb03`)

## Round 1 Important — verified resolved

| # | Claimed fix | Evidence | Verdict |
| --- | --- | --- | --- |
| 1 | `Principal` / `AccessTokenVerifier` in shared; infra implements; `modules/auth` does not re-export infra | `apps/api/src/shared/http/access-token.ts:1-7`; `infrastructure/cognito/access-token-verifier.ts:2` imports shared interface; `shared/http/types.ts:3`, `authentication-middleware.ts:2`, `modules/auth/routes/index.ts:2` import shared; `modules/auth/index.ts` exports only routes + `SignOut`; `rg` finds **no** `modules`/`shared` → `infrastructure` imports | **Resolved** |
| 2 | `signOutRequest` in `lib/sign-out.ts`; Settings default-export UI only | `apps/mobile/src/lib/sign-out.ts:1-8`; `settings.tsx:15` imports it; `settings.tsx:24` is sole export (`export default function SettingsScreen`) | **Resolved** |
| 3 | Official Hono/Zod/Node URLs + decisions in `design.md` | `docs/logs/20260812175057-r1-step1-sign-out/design.md:65-79` (“Official documentation reviewed”) with zod.dev objects, Hono middleware/routing/context/validation/zod-openapi/testing, Node test runner, and tied decisions | **Resolved** |

Independent re-review of the rest of the merge diff found no new Critical or Important skill breaks.

## Strengths

- Dependency direction now matches `organizing-api-feature-modules`: shared HTTP contracts ← infrastructure Cognito verifier; routes/use cases stay free of infra types.
- Feature endpoint naming/mount: `sign-out.ts` / `signOutRoute` / `registerSignOutRoute` / `registerAuthRoutes` → `/v1/auth/sign-out`; path-scoped `app.use('/sign-out', …)` keeps public auth routes open (`composing-hono-middleware`, `routing-hono-apis`).
- Use case is framework-free and ordered: Owner resolve → `failIfPresent` → `AuthProvider.signOut` with required collaborators (`implementing-api-use-cases`, AGENTS simplicity).
- Cognito adapter maps `NotAuthorizedException` / rate-limit classes, propagates unknowns, and asserts `GlobalSignOutCommand` input (`integrating-api-adapters`).
- OpenAPI `BearerAuth`, documented `204`/`400`/`401`/`429`/`500`, route outcome matrix + composition/OpenAPI tests (`documenting-hono-openapi`, `testing-hono-apis`).
- Spec/design/plan affirmative WHAT→HOW→WHY; Crit APPROVED; PR has Changes + Verification; iOS SETTINGS-01 / AUTH-01 evidence present.

## Skill inventory

| Skill | Applicability | Verdict |
| --- | --- | --- |
| aws-cognito | Applicable — Cognito access token + `GlobalSignOut` | Compliant — SDK v3 `GlobalSignOutCommand` via shared client; EMAIL_OTP pool flow unchanged |
| aws-login | N/A — no AWS SSO/IAM login workflow in this change | N/A |
| azure-verified-modules | N/A — no Azure / AVM work | N/A |
| bootstrapping-hono-nodejs | N/A — existing Hono package; not bootstrapped | N/A |
| composing-api-dependencies | Applicable — composition root wiring | Compliant — `index.ts` builds verifier, absent Active Walk, Sign Out, routes; composition test covers factory order |
| composing-hono-middleware | Applicable — auth gate middleware | Compliant — shared middleware, `401 UNAUTHENTICATED`, `await next()` outside verify catch, path-scoped `/sign-out`; docs URLs in `design.md` |
| confirming-development-specifications | Applicable — session specification review | Compliant — `specification-review.md` status `ready` with sources and plan-level decisions |
| connecting-drizzle-postgres | N/A — no Pool/Drizzle client changes | N/A |
| converting-zod-json-schema | N/A — no standalone JSON Schema conversion | N/A |
| creating-pull-requests | Applicable — PR #49 | Compliant — title + Changes + Verification; skill-compliance rounds recorded; fix commit `a1ddb03` |
| defining-drizzle-schemas | N/A — no Drizzle table/schema edits | N/A |
| defining-zod-schemas | Applicable — `signOutRequestSchema` | Compliant — `z.strictObject({})` in `contracts.ts:52`; zod.dev objects URL + decision in `design.md` |
| designing-github-actions-ci | N/A — no workflow design/edits | N/A |
| documenting-hono-openapi | Applicable — sign-out OpenAPI + BearerAuth | Compliant — `createRoute` + `security: [{ BearerAuth: [] }]`; `app.ts` registers BearerAuth JWT; OpenAPI test asserts path/statuses/security |
| eas-app-stores | N/A — no store submit | N/A |
| eas-hosting | N/A — no EAS Hosting | N/A |
| eas-observe | N/A — no EAS Observe | N/A |
| eas-simulator | N/A — no EAS Simulator skill usage | N/A |
| eas-update-insights | N/A — no EAS Update insights | N/A |
| eas-workflows | N/A — no EAS workflow YAML | N/A |
| explaining-specifications-and-design | Applicable — spec/design/plan | Compliant — WHAT → HOW → WHY; affirmative Settings / body / Active Walk contracts |
| expo-app-clip | N/A — no App Clip | N/A |
| expo-brownfield | N/A — no brownfield native host | N/A |
| expo-data-fetching | Applicable — `apiRequest` / Sign Out POST | Compliant — `lib/sign-out.ts` + `api.ts` 204 / Bearer / `ApiError` handling |
| expo-dev-client | N/A — no dev-client packaging changes | N/A |
| expo-dom | N/A — no DOM/webview | N/A |
| expo-examples | N/A — not scaffolding from examples | N/A |
| expo-migrate-module | N/A — no native module migration | N/A |
| expo-module | N/A — no Expo module authoring | N/A |
| expo-native-ui | N/A — Settings uses RN primitives, not expo-native-ui | N/A |
| expo-project-structure | N/A — no app scaffold/restructure | N/A |
| expo-router | Applicable — `/settings` route + home entry | Compliant — `settings.tsx` default route only; networking helper under `src/lib/` (see Minor for `<Link>`) |
| expo-skill-eval | N/A — not evaluating Expo skills | N/A |
| expo-skill-feedback | N/A — no skill feedback submission | N/A |
| expo-tailwind-setup | N/A — no Tailwind setup | N/A |
| expo-ui | N/A — no `@expo/ui` | N/A |
| expo-upgrade | N/A — no SDK upgrade | N/A |
| expo-web-to-native | N/A — no web→native migration | N/A |
| handling-zod-errors | N/A — no Zod error-message / formatting changes | N/A |
| herdr | N/A — no Herdr multiplexer use in product diff | N/A |
| implementing-api-use-cases | Applicable — `createSignOut` | Compliant — framework-free input/result; Owner → Active Walk → provider order; unit tests cover outcomes/propagation |
| implementing-drizzle-repositories | N/A — no repository implementation changes | N/A |
| integrating-api-adapters | Applicable — Cognito `signOut` adapter | Compliant — module `AuthProvider.signOut`; documented exception mapping; command-input test |
| migrating-drizzle-postgres | N/A — no migrations | N/A |
| organizing-api-feature-modules | Applicable — module/infra/shared placement | Compliant — shared contracts; infra implements; module routes/use cases; no module→infra imports |
| parsing-zod-data | N/A — no direct `parse`/`safeParse` call-site work | N/A |
| querying-drizzle-relations | N/A — no relational queries | N/A |
| querying-drizzle-sql | N/A — no SQL-like Drizzle queries | N/A |
| recording-ios-e2e-evidence | Applicable — screenshots + e2e-report | Compliant — SETTINGS-01 / AUTH-01 PNGs + `e2e-report.md` (Minor residual for deferred confirm/error) |
| retrospecting-dev-session | N/A — PR not merged; no retrospective yet | N/A |
| routing-hono-apis | Applicable — endpoint module + mount | Compliant — one method/path module; HTTP↔use-case conversion; docs recorded |
| run-dev-session | Applicable — session process | Compliant — worktree session, spec→design→plan→implement→crit→publish path with artifact sync |
| syncing-session-artifacts | Applicable — session sync before Crit/Publish and after skill-compliance fix | Compliant — transcript records `status: synced` including post-`a1ddb03` skill-compliance response |
| terraform-search-import | N/A — no Terraform | N/A |
| terraform-style-guide | N/A — no Terraform | N/A |
| terraform-test | N/A — no Terraform | N/A |
| testing-hono-apis | Applicable — route/use-case/infra/OpenAPI/composition tests | Compliant — `app.request()` matrix; nested discovery paths; OpenAPI path-method map; docs URLs recorded |
| transforming-zod-schemas | N/A — no refine/transform/codec | N/A |
| validating-hono-requests | Applicable — optional empty JSON body | Compliant — module `signOutRequestSchema` on OpenAPI route; extra keys → `400 INVALID_INPUT` without use case; validation docs recorded |

**Skills named in the review request but absent from this checkout (not among the 59):** `layering-error-responsibilities`, `separating-cross-cutting-concerns`, `open-closed-validation`, `organizing-hono-route-modules` — **N/A — not present in `.agents/skills/`**.

### AGENTS.md

| Rule | Verdict |
| --- | --- |
| Affirmative product specs (capabilities, inputs, states, transitions; errors as returned state/message/retry) | Compliant — `sign-out-specification.md`, design, Crit-approved wording, `staged-development.md` R1/R3/public-interface sync |
| Prefer simple required wiring; no quiet production substitutes | Compliant — required verifier / use-case deps; `createAbsentActiveWalkCommands` is an explicit named current implementation of `failIfPresent` |
| Skills live under `.agents/skills/`; library sync via scripts | N/A — this change does not edit skills |
| Implement R0→R3 per staged plan | Compliant — R1 Sign Out / Settings ownership recorded in staged plan |

## Issues

### Critical

None.

### Important

None. Round 1 Important #1–#3 are verified fixed in `a1ddb03` and remain fixed at HEAD.

### Minor

1. **Sign-out route re-parses `Authorization` after middleware already authenticated**  
   - **Skill / AGENTS:** `routing-hono-apis` (handler converts Context → use-case input); AGENTS simplicity.  
   - **Evidence:** `apps/api/src/modules/auth/routes/sign-out.ts:49-64` (`bearerAccessToken` + throw → 500).  
   - **Why / fix (optional):** Put the verified access token on context in authentication middleware, or pass the raw Bearer string once from a shared helper without a second failure mode.

2. **OpenAPI characterization omits sign-out request-body shape**  
   - **Skill:** `testing-hono-apis` / `documenting-hono-openapi` — assert request schema required/nullable where meaningful.  
   - **Evidence:** `apps/api/test/openapi.test.ts` asserts BearerAuth and statuses on sign-out but does not assert the empty/`additionalProperties: false` body schema (unlike email/verify helpers).  
   - **Fix (optional):** Assert sign-out request schema is an empty object.

3. **iOS evidence omits error / Active Walk confirm states**  
   - **Skill:** `recording-ios-e2e-evidence` — success, input-error, and recovery/auth-after when in scope.  
   - **Evidence:** `e2e-report.md` + `screenshots/ios-settings-idle.png`, `ios-sign-out-sign-in.png`; Active Walk confirm deferred by design.  
   - **Fix:** Acceptable for this slice; add SETTINGS-02/04 when Active Walk is wired.

4. **Home navigates with `router.push` rather than `<Link>`**  
   - **Skill:** `expo-router` prefers `<Link href=…>`.  
   - **Evidence:** `apps/mobile/src/app/(app)/index.tsx:17-18`. Matches existing auth screens; non-blocking.

5. **Residual session polish already noted in Crit**  
   - Mockup / plan Self-review absence phrasing; AUTH-01 Expo gear chrome — non-blocking.

## Assessment

| Question | Answer |
| --- | --- |
| Ready to merge? | **Yes** |
| Critical count | **0** |
| Important count | **0** |
| Merge after | No skill-compliance blockers. Optional Minor cleanups may ship later. |

**APPROVED with 0 Critical and 0 Important skill-compliance findings.**
