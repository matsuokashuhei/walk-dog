---
name: run-dev-session
description: Use when starting or continuing a focused development session in this repository.
---

# Run Development Session

Run this skill for every development session. Keep one session focused on one stated purpose.

## Start

1. Derive a concise purpose and lowercase hyphenated English slug from the first user request. Ask one question only when the purpose is ambiguous.
2. Inspect `git status --short`. Record this baseline before changing files.
3. Create `agent/<slug>-<YYYYmmddHHMMSS>` from `origin/main`. Use an isolated worktree when the current checkout contains existing work.
4. Create `docs/logs/<YYYYmmddHHMMSS>-<slug>/transcript.md` with the purpose, timestamp, baseline, and an empty artifact list.
5. Read `docs/development/staged-development.md` and record the active release, approved decisions, release acceptance conditions, and any release-start decisions that affect the purpose.
6. Append the first user request and every visible user or assistant message in chronological order.

## Purpose Boundary

Before acting, connect the action to the stated purpose and a session artifact. When a request materially changes the purpose, ask for an explicit purpose update before acting. Keep the updated purpose and reason in the transcript.

## Development Plan Sync

Use `docs/development/staged-development.md` as the release plan of record. When a user confirms a decision that changes release order, approved foundation choices, provided capabilities, public interfaces, verification conditions, or release-start decisions, classify it into the matching section and update the plan in the same session.

If a confirmed decision is implementation-local, superseded, or outside the staged plan, record that classification and reason in the transcript. Add `docs/development/staged-development.md` to the artifact list whenever it changes.

Synchronize a confirmed plan-level decision immediately after the user approves it, before presenting the next decision or starting implementation. Record the changed section and the corresponding transcript decision in the artifact log. Do not continue while a plan-level decision is unsynced or its classification is unclear.

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

Maintain the artifact list in the transcript as files are created or changed. Do not modify a path that was already changed in the baseline; record the conflict and ask for direction.

Before publishing, review every session artifact with `crit`. Exclude `transcript.md` from Crit review. Wait for the reviewer to finish, address each comment, reply through Crit, and complete review rounds until no unresolved comments remain.

## Publish

1. Stage only files in the session artifact list and `transcript.md`.
2. Commit the session artifacts and log on the dedicated branch.
3. Push the branch and create an open PR against `main`.
4. Include the session log in every PR. Do not stage baseline changes or request a separate scope decision for them.

If branch creation, review, or publishing conflicts with baseline work, record the paths, reason, and restart condition in the transcript, then stop.
