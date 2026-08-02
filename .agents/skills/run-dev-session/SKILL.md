---
name: run-dev-session
description: Use when starting or continuing a focused development session in this repository.
---

# Run Development Session

Run this skill for every development session. Keep one session focused on one stated purpose.

## Start

### Purpose Discovery

An undecided purpose begins a discovery conversation. Explore the current repository state and `docs/development/staged-development.md` read-only, then present candidate purposes and their release context. The user selects or revises a purpose. A confirmed purpose begins the execution session.

### Execution Session

1. Derive a concise purpose and lowercase hyphenated English slug from the confirmed purpose. Present the purpose and wait for the user's approval.
2. Inspect `git status --short`. Record this baseline before changing files.
3. Resolve the repository workspace root from the Git common directory. Create branch `agent/<slug>-<YYYYmmddHHMMSS>` from `origin/main` in `<workspace-root>/.worktrees/agent/<slug>-<YYYYmmddHHMMSS>`.
4. Create `docs/logs/<YYYYmmddHHMMSS>-<slug>/transcript.md` inside the workspace-local worktree with the purpose, timestamp, baseline, and an empty artifact list.
5. Read `docs/development/staged-development.md` and record the active release, approved decisions, release acceptance conditions, and any release-start decisions that affect the purpose.
6. Append the first user request and every visible user or assistant message in chronological order.
7. **REQUIRED SUB-SKILL:** Use `confirming-development-specifications` to verify the purpose against the specifications, active release, current deliverables, and plan decisions. The sub-skill creates `specification-review.md` in the session directory; add that file to the transcript artifact list.
8. Continue to design or implementation only when the specification review status is `ready`. An `awaiting-confirmation` or `blocked` review pauses the session until the required decision or source clarification is recorded.

### Workspace Boundary

Repository-owned development files and session artifacts are created under the repository workspace.

1. Set `GIT_COMMON_DIR` with `git rev-parse --git-common-dir`, then set `WORKSPACE_ROOT` to the parent directory of `GIT_COMMON_DIR`.
2. Set `WORKTREE_PATH` to `${WORKSPACE_ROOT}/.worktrees/agent/<slug>-<YYYYmmddHHMMSS>` and create the worktree from `origin/main` at that path.
3. Confirm that `.worktrees/` is covered by the repository `.gitignore` and that the resolved `WORKTREE_PATH` is under `${WORKSPACE_ROOT}/.worktrees/`.
4. If the ignore check, directory creation, `git worktree add`, or path check fails, report the path and reason, provide the retry operation, and stop the session.
5. Keep existing worktrees outside the workspace unchanged. New session files use the workspace-local worktree.

## Design and Plan

After the specification review is `ready` and before asking the user to approve a design or implementation plan:

1. **REQUIRED SUB-SKILL:** Use `explaining-specifications-and-design` to structure the user-facing design and plan explanation as WHAT → HOW → WHY. Do not present wiring, path filters, or file lists before WHAT is clear.
2. When the purpose includes **designing or changing** GitHub Actions workflow files under `.github/workflows/`, CI jobs that run those workflows, or publish pipelines implemented as workflows, **REQUIRED SUB-SKILL:** Use `designing-github-actions-ci` during design and before writing workflow YAML. Record official docs read and the gate WHAT table in the session design. Do not require this skill when only authoring or editing skills, docs, or other process artifacts about CI.
3. Present the structured design and plan, wait for approval, then continue to Task Progress.

## Task Progress

After the specification review is `ready` and the written implementation plan is approved, use `superpowers:executing-plans` to execute the plan.

1. In executing-plans Step 1.5, register every top-level Task from the plan in the live `update_plan` todos. Count each top-level Task once; steps nested under a Task are part of that Task.
2. After registering the todos and before starting the first Task, announce the total and next Task in the conversation: `Implementation plan: N tasks. Next: Task 1 — <name>`.
3. Before working on each Task, mark that todo `in_progress` and announce `Task n/N started — <name>`.
4. After the Task deliverable, required review, and Task-specific verification are complete, mark the todo `completed` and announce `Task n/N completed (n/N) — <verification summary>`.
5. When verification fails or a required decision is pending, keep the Task active and announce the current state, reason, and next action. Resume the Task after the condition is resolved.
6. When an approved plan changes its top-level Task list, update the live todos and announce the new total and the reason before continuing.

The live `update_plan` todos and the conversation announcements are the task-progress record. This workflow does not add a separate task ledger to `progress.md` or a dedicated progress section to `transcript.md`.

## Session Artifacts

`docs/logs/<timestamp>-<slug>/` holds the session transcript and every session record.

**REQUIRED SUB-SKILL:** Use `syncing-session-artifacts` whenever a session record is created or changed, and after review-response commits, follow-up fix commits, or merges into the session branch. Run it again immediately before Crit and immediately before Publish. Continue only when that skill returns `status: synced` with the matching next permitted action.

## Purpose Boundary

Discovery requests refine the purpose through conversation and read-only inspection. Execution actions connect to the approved purpose and a session artifact. A request that materially changes an approved purpose receives an explicit purpose update; keep the updated purpose and reason in the transcript.

## Development Plan Sync

Use `docs/development/staged-development.md` as the release plan of record. When a user confirms a decision that changes release order, approved foundation choices, provided capabilities, public interfaces, verification conditions, or release-start decisions, classify it into the matching section and update the plan in the same session.

If a confirmed decision is implementation-local, superseded, or outside the staged plan, record that classification and reason in the transcript. Add `docs/development/staged-development.md` to the artifact list whenever it changes.

Synchronize a confirmed plan-level decision immediately after the user approves it, before presenting the next decision or starting implementation. Record the changed section and the corresponding transcript decision in the artifact log. Do not continue while a plan-level decision is unsynced or its classification is unclear.

When the synced change is a prerequisite table (or equivalent step-to-foundation mapping):

1. Cross-check every cell against the staged plan’s release capability sections and later-release boundaries.
2. Cross-check product preconditions against the relevant files in `docs/specs/`.
3. Use affirmative precondition labels only (required for the step, required for a named environment such as local-API device verification or VPS API device verification, or not a precondition for this step).
4. Decompose mobile R0 foundations into auth state, API client, durable outbound queue, and iOS location permission; keep Cognito API verification and server-side SQS distinct.
5. Record the cross-check result in the session transcript or specification review Gaps checked before treating the table as synced.

At the end of the session, compare every confirmed decision in the transcript with `docs/development/staged-development.md`. Record each decision as synced, deferred to a named release-start decision, or outside the staged plan. Update the plan or ask for direction before publishing when the classification is unclear. The session is publishable only when this final comparison has no unresolved decision.

## Decision Questions

Use this format only when a user decision is needed:

1. When
2. Where
3. Who
4. What
5. Why
6. How

Place a separator after the proposal. Then ask one concise question that states the decision's effect in one sentence, such as "When X happens, Y returns Z. Is this acceptable?" Do not ask whether to confirm an item number. Answer factual clarifications directly.

## Artifacts and Review

**REQUIRED SUB-SKILL:** Complete `syncing-session-artifacts` with `next permitted action: crit` before starting Crit.

Before publishing, review every session artifact with `crit`. Exclude `transcript.md` from Crit review. Wait for the reviewer to finish, address each comment, reply through Crit, and complete review rounds until no unresolved comments remain. After each review-response commit, run `syncing-session-artifacts` again before the next Crit round or Publish.

## Publish

**REQUIRED SUB-SKILL:** Complete `syncing-session-artifacts` with `next permitted action: publish` immediately before these steps.

1. Stage the records in the session artifact list and `transcript.md`.
2. Commit the session artifacts and log on the dedicated branch.
3. Push the branch and create an open PR against `main`.
4. Include the session log in every PR. Do not stage baseline changes or request a separate scope decision for them.

If branch creation, review, or publishing conflicts with baseline work, record the paths, reason, and restart condition in the transcript, then stop.

## After merge

When the session pull request merges into `main` (including when the user asks to merge and merge completes):

1. **REQUIRED SUB-SKILL:** Use `retrospecting-dev-session` to turn user corrections and avoidable review comments into skill create or update proposals. Write `retrospective.md` in the session directory and add it to the Artifact List.
2. Present the skill proposals. Implement skill changes only after explicit user approval.
3. **REQUIRED SUB-SKILL:** Run `syncing-session-artifacts` after the retrospective record (and any approved skill edits) change session files. After that sync, the next permitted action is `open-follow-up-pr` until a follow-up PR exists.
4. Land the retrospective (and any approved skill edits) on `main` via a follow-up PR:
   - Prefer a new branch from `origin/main` (the session branch may already be deleted after merge).
   - Commit `retrospective.md`, the updated transcript and Artifact List, and any approved skill file changes.
   - Push and open a follow-up PR against `main`.
5. When the follow-up PR merges, or when the user declines skill implementation and only the retrospective record lands and merges, the next permitted action is `done`.
