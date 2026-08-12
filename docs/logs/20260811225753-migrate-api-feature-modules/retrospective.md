# API feature module migration retrospective

- status: `implemented`
- merged PR: #47
- merge commit: `dd38d690ab594160457da20359bd04a58581723d`
- follow-up branch: `agent/api-feature-module-migration-retrospective-20260812121500`

## Evidence

- The migration preserved the public API and OpenAPI contracts, expanded the suite from the 45-test baseline to 145 unit tests plus one PostgreSQL integration test, and passed lint, duplication, unused-code, typecheck, build, migration-diff, skill-link, and whitespace gates.
- Independent reviews found Important issues in OpenAPI characterization, route-result coverage, repository cleanup, graceful shutdown, entrypoint verification, and artifact consistency. Every implementation finding was fixed and independently re-reviewed as `APPROVED` before publication.
- GitHub CI passed lint, jscpd, knip, and typecheck. GitHub recorded no human review threads; the Cursor comment reported that Bugbot review was unavailable for the account.
- The user approved PR #47 and requested its merge. GitHub merged it as `dd38d690ab594160457da20359bd04a58581723d` on 2026-08-12.

## Findings and skill actions

### 1. Exhaustive HTTP and OpenAPI contract matrices

- trigger: The first OpenAPI characterization checked expected operations without proving the complete path-to-method map, and the Sign In Verify route suite covered its 400 status without covering the distinct reachable `code-already-used` outcome.
- review gap: Status-based sampling did not establish equality between the route/use-case outcome union, HTTP cases, and generated OpenAPI surface.
- desired behavior: Contract evidence defines the exact path-to-method map, required and nullable schema fields, and one HTTP case for every reachable feature outcome, including outcomes that share a status.
- proposed skill action: Update `.agents/skills/testing-hono-apis/SKILL.md` in `Route契約test` and `Aggregate、OpenAPI、composition` to require an explicit outcome-to-HTTP matrix, one route case per reachable result-union member, complete required/nullable assertions, and exact OpenAPI path-to-method equality so extra paths or methods fail the test.

### 2. Complete resource cleanup and entrypoint evidence

- trigger: Repository integration cleanup could leave the PostgreSQL Pool open after a row-cleanup failure; server shutdown could skip Cognito and Sentry after a Pool failure; in-process entry tests could pass without proving direct startup behavior.
- review gap: Lifecycle tests covered the normal order while failure-position coverage and process-boundary behavior remained implicit.
- desired behavior: Shutdown attempts listener, Pool, external clients, and observability exactly once in order, preserves the first failure, returns one idempotent promise, and proves import-only and direct-source entry behavior in isolated processes.
- proposed skill action: Update `.agents/skills/bootstrapping-hono-nodejs/SKILL.md` with the owned-resource shutdown invariant and update `.agents/skills/testing-hono-apis/SKILL.md` to require failure-position tests, unconditional integration-handle closure, and subprocess evidence for import safety and direct entry execution.

### 3. Business-key conflict targets

- trigger: The Owner resolver initially used untargeted `onConflictDoNothing()`, allowing unrelated future uniqueness constraints to enter the resolve-existing path.
- review gap: The query workflow recorded the mutation and transaction but did not require the conflict target to match the business key used by the follow-up select.
- desired behavior: Insert-or-resolve queries name the unique business key as the conflict target and test that exact target together with inserted and existing-row paths.
- proposed skill action: Update `.agents/skills/querying-drizzle-sql/SKILL.md` in `Project defaults`, `Common decisions`, and `Completion check` to require an explicit conflict target for business-key resolution and an assertion that the conflict target matches the subsequent lookup key.

### 4. Cross-artifact state consistency

- trigger: During Task 6 review, the completion checklist reported Task 6B and its gates complete while the transcript and verification record still described that work as pending.
- review gap: Artifact sync inspected each record but did not compare shared state fields as one consistency gate.
- desired behavior: Transcript, checklist, verification, and retrospective agree on task phase, test totals, review state, commit state, publication state, and next permitted action before review or publication.
- proposed skill action: Update `.agents/skills/syncing-session-artifacts/SKILL.md` in `Compare session reality` and its completion check to require a cross-artifact state matrix and return `blocked` when those shared facts conflict.

### 5. Temporary dependency-link lifecycle

- trigger: A worktree verification attempt created a real `node_modules` directory containing a symlink, loaded two Hono copies, and produced false HTTP 500 results; a self-referential nested link then remained in the main checkout until final inspection.
- review gap: The session workflow defined worktree ownership and cleanup while dependency reuse lacked preflight and post-cleanup invariants.
- desired behavior: Temporary dependency reuse creates one symlink at an absent path, confirms its resolved target before tests, removes that exact link after tests, and verifies the worktree link plus nested target paths are absent.
- proposed skill action: Update `.agents/skills/run-dev-session/SKILL.md` in `Workspace Boundary` with a temporary dependency-link lifecycle: preflight path type and target, one exact link, absolute-path cleanup, and explicit absence checks for both the worktree path and accidental nested link path.

## Applied during PR #47

- OpenAPI characterization now asserts the exact public path-to-method map and complete nullable request-schema behavior.
- Sign In Verify route tests cover `code-already-used` independently from other 400 outcomes.
- Owner conflict handling targets `owners.cognitoSubject`, and integration cleanup always closes its Pool.
- Server shutdown attempts every owned resource while preserving the first failure; isolated subprocess tests prove import-only and direct-source entry behavior.
- Task 6 artifacts were synchronized before final review, and both temporary dependency links were removed and verified absent before commit.

## Proposed follow-up

1. Open a follow-up PR against `main` containing the retrospective, transcript, and approved skill updates.
2. After the follow-up PR merges, remove both session-owned worktrees and prune the worktree registry.

## Approval

- `2026-08-12`: User approved all five proposed skill actions.

## Implementation evidence

### HTTP contracts and lifecycle tests

- baseline: PR #47 review evidence showed expected-operation spot checks, status-based outcome sampling, conditional integration cleanup, and in-process entry checks could leave contract and lifecycle gaps.
- change: `testing-hono-apis` now requires a reachable outcome-to-HTTP matrix, one route case per union member, exact OpenAPI path-to-method equality, complete required/nullable assertions, unconditional handle cleanup, subprocess entry evidence, and shutdown failure-position coverage.
- forward-test: A fresh Cursor Agent produced separate 400 cases for `invalid-code` and `code-already-used`, exact operation equality, required-plus-nullable schema checks, Pool cleanup after delete failure, subprocess entry cases, and downstream close assertions after Pool/client failures.
- validation: quick validation passed.

### Owned-resource shutdown

- baseline: The runtime bootstrap skill specified graceful shutdown without defining behavior after a close failure or across repeated calls.
- change: `bootstrapping-hono-nodejs` now defines listener → Pool → external clients → observability, one attempt per resource, full-sequence completion, first-failure propagation, and one shared shutdown promise.
- forward-test: With Pool `EPOOL` and observability `ESENTRY`, a fresh Cursor Agent kept the full close order, returned the same promise to concurrent callers, and propagated `EPOOL` after all attempts.
- validation: quick validation passed.

### Business-key conflict handling

- baseline: The SQL skill did not structurally connect an insert conflict target to the unique key used by the resolve-existing lookup.
- change: `querying-drizzle-sql` now requires that key equality and requires inserted/existing-path verification.
- forward-test: A fresh Cursor Agent selected `onConflictDoNothing({ target: owners.cognitoSubject })` despite another unique `publicId` and required exact-target assertions on both paths.
- validation: quick validation passed.

### Cross-artifact state consistency

- baseline: Artifact sync could inspect each file yet return success while task phase, test totals, or review state differed between records.
- change: `syncing-session-artifacts` now builds an equality matrix for task phase, test totals, review, commit, publication, and next action; conflicting fields return `blocked` with their artifact paths.
- forward-test: A fresh Cursor Agent returned `blocked` for pending/complete, 140/145, and pending/approved conflicts and withheld every continuation action until reconciliation.
- validation: quick validation passed.

### Temporary dependency reuse

- baseline: The session skill defined worktree cleanup without a dependency-link lifecycle.
- change: `run-dev-session` now requires a real source, absent destination, one absolute symlink, resolved-target and nested-path checks, verified unlink, and source preservation.
- forward-test: Refusal path — with a real directory at the destination, a fresh Cursor Agent stopped before linking, named the absent-destination retry condition, and stated the setup and cleanup invariants. Success path — with an absent destination, a fresh Cursor Agent created exactly one absolute symlink, verified the resolved target and nested absence, completed verified unlink, and confirmed final destination/nested absence with source preservation.
- validation: quick validation passed.

### Repository skill view

- The canonical bodies for bootstrap shutdown, Drizzle queries, development sessions, artifact sync, and Hono API testing are Japanese. Each existing `SKILL_ja.md` sibling is byte-identical to its canonical body.
- Because the four canonical bodies are Japanese, their redundant `SKILL_ja.md` siblings were removed; `testing-hono-apis` has no sibling file and was unchanged.
- `.agents/skill-library/` was regenerated from `.agents/skills/`.
- `scripts/agent-skills.sh check`, all five quick validations, and `git diff --check` passed.
- Cursor Agent full-diff review found four Important artifact/parity/evidence issues; all were fixed, and the independent re-review returned `APPROVED` with no Critical or Important findings.
- After the user requested Japanese skill bodies in PR #48, Cursor Agent translated the four remaining English canonical bodies. A semantic review found and fixed six Important translation differences; the final re-review returned `APPROVED`.
