# Retrospective

- Session: R1 Step 1 Sign Up (API + Mobile)
- Timestamp: 20260802200405
- Status: awaiting-approval

## Findings

### F1: PR numbering in titles

- Trigger: PR titles used internal numbering ("PR 1", "PR 2") meaningless to reviewers.
- Missed behavior: User asked "PR1とは？" and called titles high-context.
- Desired behavior: PR titles are self-descriptive nouns without internal references.
- Skill action: Create `.agents/skills/creating-pull-requests/SKILL.md` — title must be self-contained, no internal numbering. **Done during session.**

### F2: `nonempty` wording violated AGENTS.md

- Trigger: Skill text said "Use `.nonempty()` instead of `.min(1)`. `.min(1)` accepts any single character including whitespace."
- Missed behavior: User pointed out it violates AGENTS.md 文書 rules (negative framing, implementation details, out-of-scope comparison).
- Desired behavior: Only state positive terms: "Use `.nonempty()` for non-empty string validation."
- Skill action: Update `.agents/skills/defining-zod-schemas/SKILL.md` — add rule: "Use `.nonempty()` for non-empty string validation." in positive terms only. **Done during session.**

### F3: Drizzle docs URLs broken

- Trigger: All `/docs/pg/` URLs in 5 skills returned 404.
- Missed behavior: User found `--name` flag from drizzle docs that the skill missed; subsequent investigation revealed all `/docs/pg/` URLs were broken.
- Desired behavior: Skill documentation URLs must be verified to return 200. When Drizzle docs restructure URLs, skills must be updated.
- Skill action: Update `.agents/skills/migrating-drizzle-postgres/SKILL.md` — fix docs URLs. **Done during session.** But root cause is skill review process never checked URLs. Consider adding a URL validity check to skill creation workflow.

### F4: Missing unit tests for new routes

- Trigger: Sign-up and verify endpoints had no tests in PR 2.
- Missed behavior: User asked "なぜ？" (why no tests?).
- Desired behavior: Every new route has at minimum success and known-error tests.
- Skill action: Update `routing-hono-apis` skill to require test patterns for every route: success path, each documented error status, and validation failure.

### F5: Session artifact loss

- Trigger: `sign-up-api-spec.md`, `sign-up-screens.html`, and `docs/logs/` session artifacts were never committed. Lost after branch reset.
- Missed behavior: Session artifacts disappeared when the worktree was reset.
- Desired behavior: Session artifacts (transcript, spec review, design docs, screens) are committed to the session branch and survive resets.
- Skill action: Update `run-dev-session` — after session record creation, stage and commit the artifact files to guarantee they survive worktree operations.

### F6: Worktree vs main repo file confusion

- Trigger: Edits to `.agents/skills/` via the `edit` tool targeted the main repo, not the worktree. Had to re-apply edits in the worktree.
- Missed behavior: Skill files that existed in both locations diverged silently.
- Desired behavior: All file operations within a session target the worktree path consistently.
- Skill action: Update `syncing-session-artifacts` — add a cross-check between main-repo and worktree `.agents/skills/` files before syncing.

### F7: Cognito flow verification (positive)

- Trigger: Codex terra repeatedly flagged `ConfirmSignUp` session behavior as impossible. User provided Rust code proving it worked.
- Missed behavior: Codex terra model was incorrect about Cognito API capabilities.
- Desired behavior: The team now has evidence-based understanding of the Cognito session flow. No skill change needed.
- Status: Record only, no skill action.

## Proposed skill actions

| ID | Skill | Action | Status |
|----|-------|--------|--------|
| F1 | `creating-pull-requests` | Created during session | done |
| F2 | `defining-zod-schemas` | Fixed wording during session | done |
| F3 | `migrating-drizzle-postgres` + 4 other skills | Fixed URLs during session | done |
| F4 | `routing-hono-apis` | Add test requirement for new routes | done |
| F5 | `run-dev-session` | Add artifact commit step after creation | done |
| F6 | `syncing-session-artifacts` | Add worktree cross-check | done |
| F7 | `aws-login` | Create AWS SSO login skill | done |
| F8 | `aws-cognito` | Create Cognito + SES skill | done |
