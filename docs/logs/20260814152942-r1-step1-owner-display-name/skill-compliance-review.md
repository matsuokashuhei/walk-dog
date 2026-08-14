# Skill-compliance review — Owner display name (`8bc6f67`..`1dbb32b`)

- **status:** APPROVED
- **date:** 2026-08-14
- **reviewer:** Senior Code Reviewer ([Review](11b969d9-6d60-492a-b21c-fccfbe7b6c85))
- **model:** Cursor Grok 4.6
- **checkout:** `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step1-owner-display-name-20260814152942`
- **branch:** `agent/r1-step1-owner-display-name-20260814152942`
- **scope:** `AGENTS.md` + every directory under `.agents/skills/`. Diff: `git diff 8bc6f67..1dbb32b`
- **round:** 2 (re-review after Important fixes in `1dbb32b`)

## Round 1 Important — verified resolved

| # | Claimed fix | Evidence | Verdict |
| --- | --- | --- | --- |
| 1 | PATCH `/v1/owner` invalid classes and full 400/401 envelope | `apps/api/test/modules/owners/routes/update-owner.test.ts` covers whitespace, missing `displayName`, 101 characters, extra keys, malformed JSON; `assertInvalidInput` checks `400`, `INVALID_INPUT`, `入力内容を確認してください。`, `requestId`, `retryable: false`, and that the use case was not called; PATCH 401 matches the sign-out envelope | **Resolved** |
| 2 | OpenAPI PATCH request schema | `apps/api/test/openapi.test.ts` `requestSchema` takes a method; `assertOwnerPatchRequestSchema` requires `displayName`, `minLength: 1`, `maxLength: 100`, non-nullable | **Resolved** |

Independent re-review of the rest of `8bc6f67`..`1dbb32b` found no new Critical or Important skill breaks.

## Strengths

- Round 1 Important items are locked with the same invalid-class and OpenAPI request assertions the auth suite uses.
- `owners` owns contracts, use cases, and routes; use cases return module `Owner`; composition mounts `/v1/owner` once.
- Mobile HTTP stays in `lib/owner-api.ts`; `Stack.Protected` gates on `displayName === null`.
- iOS evidence still attached: idle, invalid, home.

## Skill inventory

| Skill | Applicability | Verdict |
| --- | --- | --- |
| bootstrapping-hono-nodejs | N/A — no new API package | N/A |
| brainstorming | Applicable — design approved before implementation | Pass |
| composing-api-dependencies | Applicable — `createUseCases` / `createOwnerRoutes` / mount | Pass |
| composing-hono-middleware | Applicable — BearerAuth on owner child app | Pass |
| confirming-development-specifications | Applicable — spec review, mockups, API HTML | Pass |
| connecting-drizzle-postgres | N/A — no client/pool change | N/A |
| converting-zod-json-schema | N/A — OpenAPI via `@hono/zod-openapi` | N/A |
| creating-pull-requests | N/A — PR is not in this range | N/A |
| defining-drizzle-schemas | N/A — `display_name` already exists | N/A |
| defining-zod-schemas | Applicable — `updateOwnerRequestSchema`; Zod docs recorded | Pass |
| designing-github-actions-ci | N/A — no workflow change | N/A |
| dispatching-parallel-agents | N/A — executed via `executing-plans` | N/A |
| documenting-hono-openapi | Applicable — GET/PATCH, BearerAuth, PATCH request schema asserted | Pass |
| eas-app-stores | N/A | N/A |
| eas-hosting | N/A | N/A |
| eas-observe | N/A | N/A |
| eas-simulator | N/A — local `simctl` + existing dev client | N/A |
| eas-update-insights | N/A | N/A |
| eas-workflows | N/A | N/A |
| executing-plans | Applicable — Tasks 1–5 then review-response commit | Pass |
| explaining-specifications-and-design | Applicable — design WHAT → HOW → WHY | Pass |
| expo-app-clip | N/A | N/A |
| expo-brownfield | N/A | N/A |
| expo-data-fetching | Applicable — `apiRequest` via `owner-api.ts` | Pass |
| expo-design-system | N/A — existing RN `StyleSheet` | N/A |
| expo-dev-client | N/A — reused existing client | N/A |
| expo-dom | N/A | N/A |
| expo-examples | N/A | N/A |
| expo-migrate-module | N/A | N/A |
| expo-module | N/A | N/A |
| expo-native-ui | N/A — RN primitives | N/A |
| expo-project-structure | N/A — existing app; skill is new-project only | N/A |
| expo-router | Applicable — `/owner/display-name`, `Stack.Protected` | Pass |
| expo-skill-eval | N/A | N/A |
| expo-skill-feedback | N/A | N/A |
| expo-tailwind-setup | N/A | N/A |
| expo-ui | N/A | N/A |
| expo-upgrade | N/A | N/A |
| expo-web-to-native | N/A | N/A |
| finishing-a-development-branch | Applicable — verify + integrate options; awaiting PR | Pass |
| handling-zod-errors | N/A — shared 400 hook | N/A |
| herdr | N/A | N/A |
| implementing-api-use-cases | Applicable — no Hono/Zod/Drizzle in use cases | Pass |
| implementing-drizzle-repositories | Applicable — `updateDisplayName` + `toOwner` | Pass |
| integrating-api-adapters | N/A — no adapter change | N/A |
| migrating-drizzle-postgres | N/A — no migration | N/A |
| organizing-api-feature-modules | Applicable — `modules/owners/{contracts,routes,use-cases}` | Pass |
| organizing-mobile-api-clients | Applicable — `lib/owner-api.ts`; screens do not call `apiRequest` | Pass |
| parsing-zod-data | N/A — `c.req.valid('json')` | N/A |
| querying-drizzle-relations | N/A — SQL-like update | N/A |
| querying-drizzle-sql | Applicable — update docs URL now in design.md | Pass |
| receiving-code-review | Applicable — round 1 Important items implemented | Pass |
| recording-ios-e2e-evidence | Applicable — idle, invalid, home PNG + report | Pass |
| requesting-code-review | Applicable — round 1 then this re-review | Pass |
| retrospecting-dev-session | N/A — after merge | N/A |
| routing-hono-apis | Applicable — GET/PATCH endpoint modules + aggregate | Pass |
| run-dev-session | Applicable — worktree, transcript, plan approval | Pass |
| subagent-driven-development | N/A — plan allows executing-plans | N/A |
| syncing-session-artifacts | Applicable — spec-review next action aligned; transcript SHA lag is Minor | Pass |
| systematic-debugging | N/A — no production bug hunt | N/A |
| terraform-search-import | N/A | N/A |
| terraform-style-guide | N/A | N/A |
| terraform-test | N/A | N/A |
| test-driven-development | Applicable — failing contract tests added then locked | Pass |
| testing-hono-apis | Applicable — invalid classes, envelopes, OpenAPI request schema | Pass |
| transforming-zod-schemas | Applicable — `.trim()` then nonempty/max | Pass |
| using-git-worktrees | Applicable — session worktree | Pass |
| using-superpowers | Applicable — listed skills used | Pass |
| validating-hono-requests | Applicable — same schema in route + `c.req.valid`; invalid classes tested | Pass |
| verification-before-completion | Applicable — prior 181/`check`/`tsc`/E2E recorded | Pass |
| writing-plans | Applicable — plan header and task-to-design table | Pass |
| writing-skills | N/A — no skill authoring | N/A |

**AGENTS.md:** Specs stay affirmative; production wiring is required injection. Remaining defensiveness (`OwnerProvider` null session) is Minor.

## Issues

### Critical

None.

### Important

None. Round 1 items 1 and 2 are resolved in `1dbb32b`.

### Minor

1. **GET 401 still asserts only `code` and `retryable`**  
   File: `apps/api/test/modules/owners/routes/get-owner.test.ts` (401 case). PATCH 401 now has the full envelope; GET 401 does not. Same middleware, not a contract gap.

2. **`OwnerProvider` still returns `null` when `session` is missing**  
   File: `apps/mobile/src/lib/owner.tsx`. `(app)` is already behind `Stack.Protected guard={session !== null}`. Unchanged from round 1; not a merge blocker.

3. **Transcript Sync block still describes `a28651c` / 181 tests**  
   File: `docs/logs/20260814152942-r1-step1-owner-display-name/transcript.md` (Sync section). HEAD at review time was `1dbb32b` with additional route/OpenAPI cases. Refresh on the next session sync.

## Assessment

**Ready to merge?** Yes  
**Skill-compliance:** APPROVED  
**Critical count:** 0  
**Important count:** 0  
**Reasoning:** The two merge-blocking test gaps are closed with the same invalid-class and OpenAPI request assertions the auth suite already uses. Leftover notes are polish and do not break the public contract, security, or required architecture.

Request: `docs/logs/20260814152942-r1-step1-owner-display-name/skill-compliance-review-request.md`
