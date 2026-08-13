# Skill-compliance review — Sign Out (`327d0f91`..`c3e04add`)

- **status:** CHANGES_REQUESTED
- **date:** 2026-08-13
- **reviewer:** Senior Code Reviewer (Cursor Grok 4.5)
- **target:** PR https://github.com/matsuokashuhei/walk-dog/pull/49
- **checkout:** `.worktrees/agent/r1-step1-sign-out-20260812175057`
- **scope:** `AGENTS.md` + every directory under `.agents/skills/` (59 skills). Skills named in the request that are absent from this checkout (`layering-error-responsibilities`, `separating-cross-cutting-concerns`, `open-closed-validation`, `organizing-hono-route-modules`) are noted as not present.

## Strengths

- Feature-first auth endpoint naming and mount match the plan (`sign-out.ts`, `signOutRoute`, `registerSignOutRoute`, `registerAuthRoutes` → `/v1/auth/sign-out`).
- Use case stays framework-free: Owner resolve → `failIfPresent` → `AuthProvider.signOut`, with required collaborators and an explicit absent Active Walk port.
- Cognito adapter maps documented exceptions (`NotAuthorizedException`, rate-limit classes) and propagates unknowns; GlobalSignOut command input is tested.
- Auth gate returns the shared `401 UNAUTHENTICATED` envelope; path-scoped middleware keeps public sign-up/sign-in unprotected.
- OpenAPI registers `BearerAuth` and documents sign-out `204`/`400`/`401`/`429`/`500`; route tests cover the outcome matrix.
- Spec / design / plan use WHAT → HOW → WHY and affirmative Settings / body contracts; session Crit APPROVED; PR has Changes + Verification; iOS evidence covers SETTINGS-01 and AUTH-01.

## Skill inventory

| Skill | Applicability | Verdict |
| --- | --- | --- |
| aws-cognito | Applicable — Cognito `GlobalSignOut` / access token | Compliant |
| aws-login | N/A — no AWS SSO/IAM login workflow in this change | N/A |
| azure-verified-modules | N/A — no Azure / AVM work | N/A |
| bootstrapping-hono-nodejs | N/A — existing Hono package; not bootstrapped | N/A |
| composing-api-dependencies | Applicable — composition root wiring | Compliant |
| composing-hono-middleware | Applicable — auth gate middleware | Compliant (code); see Important #3 for docs recording |
| confirming-development-specifications | Applicable — session specification review | Compliant |
| connecting-drizzle-postgres | N/A — no Pool/Drizzle client changes | N/A |
| converting-zod-json-schema | N/A — no standalone JSON Schema conversion | N/A |
| creating-pull-requests | Applicable — PR #49 | Compliant |
| defining-drizzle-schemas | N/A — no Drizzle table/schema edits | N/A |
| defining-zod-schemas | Applicable — `signOutRequestSchema` | Changes requested (docs recording) |
| designing-github-actions-ci | N/A — no workflow design/edits | N/A |
| documenting-hono-openapi | Applicable — sign-out OpenAPI + BearerAuth | Compliant (code); see Important #3 |
| eas-app-stores | N/A — no store submit | N/A |
| eas-hosting | N/A — no EAS Hosting | N/A |
| eas-observe | N/A — no EAS Observe | N/A |
| eas-simulator | N/A — no EAS Simulator skill usage | N/A |
| eas-update-insights | N/A — no EAS Update insights | N/A |
| eas-workflows | N/A — no EAS workflow YAML | N/A |
| explaining-specifications-and-design | Applicable — spec/design/plan | Compliant |
| expo-app-clip | N/A — no App Clip | N/A |
| expo-brownfield | N/A — no brownfield native host | N/A |
| expo-data-fetching | Applicable — `apiRequest` / Sign Out POST | Compliant |
| expo-dev-client | N/A — no dev-client packaging changes | N/A |
| expo-dom | N/A — no DOM/webview | N/A |
| expo-examples | N/A — not scaffolding from examples | N/A |
| expo-migrate-module | N/A — no native module migration | N/A |
| expo-module | N/A — no Expo module authoring | N/A |
| expo-native-ui | N/A — Settings uses RN primitives, not expo-native-ui | N/A |
| expo-project-structure | N/A — no app scaffold/restructure | N/A |
| expo-router | Applicable — `/settings` route + home entry | Changes requested |
| expo-skill-eval | N/A — not evaluating Expo skills | N/A |
| expo-skill-feedback | N/A — no skill feedback submission | N/A |
| expo-tailwind-setup | N/A — no Tailwind setup | N/A |
| expo-ui | N/A — no `@expo/ui` | N/A |
| expo-upgrade | N/A — no SDK upgrade | N/A |
| expo-web-to-native | N/A — no web→native migration | N/A |
| handling-zod-errors | N/A — no Zod error-message / formatting changes | N/A |
| herdr | N/A — no Herdr multiplexer use in product diff | N/A |
| implementing-api-use-cases | Applicable — `createSignOut` | Compliant |
| implementing-drizzle-repositories | N/A — no repository implementation changes | N/A |
| integrating-api-adapters | Applicable — Cognito `signOut` adapter | Compliant |
| migrating-drizzle-postgres | N/A — no migrations | N/A |
| organizing-api-feature-modules | Applicable — module/infra/shared placement | Changes requested |
| parsing-zod-data | N/A — no direct `parse`/`safeParse` call-site work | N/A |
| querying-drizzle-relations | N/A — no relational queries | N/A |
| querying-drizzle-sql | N/A — no SQL-like Drizzle queries | N/A |
| recording-ios-e2e-evidence | Applicable — screenshots + e2e-report | Compliant (Minor residual) |
| retrospecting-dev-session | N/A — PR not merged; no retrospective yet | N/A |
| routing-hono-apis | Applicable — endpoint module + mount | Compliant (code); see Important #3 |
| run-dev-session | Applicable — session process | Compliant |
| syncing-session-artifacts | Applicable — session sync before Crit/Publish | Compliant |
| terraform-search-import | N/A — no Terraform | N/A |
| terraform-style-guide | N/A — no Terraform | N/A |
| terraform-test | N/A — no Terraform | N/A |
| testing-hono-apis | Applicable — route/use-case/infra/OpenAPI/composition tests | Compliant (code); see Important #3 |
| transforming-zod-schemas | N/A — no refine/transform/codec | N/A |
| validating-hono-requests | Applicable — optional empty JSON body | Compliant (code); see Important #3 |
| layering-error-responsibilities | Not present in this checkout | N/A |
| separating-cross-cutting-concerns | Not present in this checkout | N/A |
| open-closed-validation | Not present in this checkout | N/A |
| organizing-hono-route-modules | Not present in this checkout | N/A |

### AGENTS.md

| Rule | Verdict |
| --- | --- |
| Affirmative product specs (capabilities, inputs, states, transitions; errors as returned state/message/retry) | Compliant — `sign-out-specification.md`, design, staged-development sync after Crit |
| Prefer simple required wiring; no quiet production substitutes | Compliant — required verifier / `failIfPresent` / use-case deps; `createAbsentActiveWalkCommands` is an explicit named current implementation |

## Issues

### Critical

None.

### Important

1. **`shared` / `modules/auth` import infrastructure types (dependency direction)**  
   - **Skill:** `organizing-api-feature-modules` — dependency direction is `route → use case → module interface ← infrastructure`; shared holds cross-cutting contracts; infrastructure implements module/shared interfaces. Also conflicts with `composing-hono-middleware` placement: verifier *implementation* in `infrastructure/cognito/`, while `principal` / verifier *contracts* are shared HTTP types.  
   - **Evidence:**  
     - `apps/api/src/shared/http/types.ts:3` imports `Principal` from `infrastructure/cognito/access-token-verifier.ts`  
     - `apps/api/src/shared/http/authentication-middleware.ts:2-5` imports `AccessTokenVerifier` / `Principal` from infrastructure  
     - `apps/api/src/modules/auth/routes/index.ts:2` imports `AccessTokenVerifier` from infrastructure  
     - `apps/api/src/modules/auth/index.ts:5` re-exports `AccessTokenVerifier` from infrastructure  
   - **Why:** Module and shared layers must not depend on (or re-export) infrastructure. The Cognito JWT library belongs only in the infrastructure factory.  
   - **Fix:** Move `Principal` and `AccessTokenVerifier` to `apps/api/src/shared/http/` (e.g. `access-token.ts`). Keep `createAccessTokenVerifier` in `infrastructure/cognito/` implementing that shared interface. Update middleware, auth routes, composition, and tests to import the shared types; stop re-exporting infrastructure from `modules/auth`.

2. **Utility co-located in Expo Router `app` route file**  
   - **Skill:** `expo-router` / `references/route-structure.md` — “Never co-locate components, types, or utilities in the app directory”; app files should export a default route component.  
   - **Evidence:** `apps/mobile/src/app/(app)/settings.tsx:23-28` exports `signOutRequest` beside the default Settings screen.  
   - **Why:** Networking helper belongs under `src/lib/` (alongside `api.ts` / `active-walk.ts`), not in the route module.  
   - **Fix:** Move `signOutRequest` to e.g. `apps/mobile/src/lib/sign-out.ts` (or extend `api.ts`) and import it from the Settings screen; leave `settings.tsx` as default-export-only UI.

3. **Official Hono/Zod documentation URLs not recorded**  
   - **Skills:** `defining-zod-schemas`, `routing-hono-apis`, `composing-hono-middleware`, `documenting-hono-openapi`, `validating-hono-requests`, `testing-hono-apis` — each requires reading current official docs and recording URLs + decisions in the session log, design, or PR.  
   - **Evidence:** Session artifacts under `docs/logs/20260812175057-r1-step1-sign-out/` and PR #49 body mention stack (`@hono/zod-openapi`, Zod 4, `aws-jwt-verify`) but contain no `hono.dev` / `zod.dev` (or equivalent) documentation URLs or schema/routing decisions tied to those reads. `signOutRequestSchema = z.strictObject({})` in `apps/api/src/modules/auth/contracts.ts:52` is a schema definition change that triggers `defining-zod-schemas`.  
   - **Why:** Skill completion gates require an auditable docs-review trail for API/Zod work.  
   - **Fix:** Add a short transcript (or PR) entry listing the docs URLs read and the decisions (optional empty `strictObject` body, BearerAuth security scheme, path-scoped auth middleware, `app.request()` route tests). No product-code change required if the implementation already matches those docs.

### Minor

1. **Sign-out route re-parses `Authorization` after middleware already authenticated**  
   - **Skill / AGENTS:** `routing-hono-apis` (handler converts Context → use-case input); AGENTS simplicity.  
   - **Evidence:** `apps/api/src/modules/auth/routes/sign-out.ts:49-64` (`bearerAccessToken` + throw → 500).  
   - **Fix (optional):** Put the verified access token on context in authentication middleware, or pass the raw Bearer string once from a shared helper without a second failure mode.

2. **OpenAPI characterization omits sign-out request-body shape**  
   - **Skill:** `testing-hono-apis` / `documenting-hono-openapi` — assert request schema required/nullable where meaningful.  
   - **Evidence:** `apps/api/test/openapi.test.ts` asserts BearerAuth on sign-out statuses but does not assert the empty/strict body schema (unlike email/verify helpers).  
   - **Fix (optional):** Assert sign-out request schema is an empty object (no required properties / additionalProperties false as generated).

3. **iOS evidence omits error / Active Walk confirm states**  
   - **Skill:** `recording-ios-e2e-evidence` — success, input-error, and recovery/auth-after when in scope.  
   - **Evidence:** `e2e-report.md` + `screenshots/ios-settings-idle.png`, `ios-sign-out-sign-in.png`; design defers Active Walk confirm evidence.  
   - **Fix:** Acceptable for this slice; add SETTINGS-02/04 when Active Walk is wired.

4. **Home navigates with `router.push` rather than `<Link>`**  
   - **Skill:** `expo-router` prefers `<Link href=…>`.  
   - **Evidence:** `apps/mobile/src/app/(app)/index.tsx:17-18`. Matches existing auth screens; non-blocking.

5. **Residual session polish already noted in Crit**  
   - Mockup / plan Self-review absence phrasing; AUTH-01 Expo gear chrome — non-blocking.

## Assessment

| Question | Answer |
| --- | --- |
| Ready to merge? | **No** — With fixes |
| Critical count | **0** |
| Important count | **3** |
| Merge after | (1) move `Principal` / `AccessTokenVerifier` to shared and stop module→infrastructure type imports; (2) move `signOutRequest` out of `app/`; (3) record Hono/Zod official-doc URLs and decisions in session log or PR |

Product contract, security envelope, composition, use-case order, adapter mapping, OpenAPI path, Settings flow, and iOS SETTINGS-01 / AUTH-01 evidence look sound. Blockers are skill architecture / Expo route placement / docs-recording compliance, not a broken Sign Out contract.

## Response

1. Moved `Principal` and `AccessTokenVerifier` to `apps/api/src/shared/http/access-token.ts`. Infrastructure `createAccessTokenVerifier` implements that interface. Shared middleware, auth routes, composition, and tests import the shared types. `modules/auth` no longer re-exports infrastructure.
2. Moved `signOutRequest` to `apps/mobile/src/lib/sign-out.ts`. `settings.tsx` is the default route component only.
3. Recorded official Hono/Zod/Node test-runner URLs and decisions in `design.md` under "Official documentation reviewed".

