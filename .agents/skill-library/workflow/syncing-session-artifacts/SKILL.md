---
name: syncing-session-artifacts
description: Use when a walk-dog development session creates or changes session records, or after review fixes, follow-up commits, or main merges that must update transcript, design, plan, and checklist before continuing.
---

# Syncing Session Artifacts

Keep the active session directory aligned with session reality. Update transcript, design, plan, checklist, and related records whenever the session state changes, not only before publish.

## Required sources

Read these sources in this order:

1. The active `docs/logs/<timestamp>-<slug>/transcript.md` for purpose, baseline, Artifact List, and chronological events.
2. The other records in that session directory (design, plan, specification-review, completion checklist, verification).
3. The current branch diff and recent commits for review fixes, follow-up fixes, and merges that landed after the last artifact sync.
4. The session baseline recorded at start, for conflict detection against paths already dirty before the session.

Session artifacts define what the session claims; commits and diffs define what changed; the baseline defines which paths the session must not silently overwrite.

## Worktree consistency check

Before syncing, verify that `.agents/skill-library/` files modified in the session exist at the same revision in both the worktree and the main repository checkout. When the session created or edited a skill file, regenerate `.agents/skills/` from the canonical library before checking the discovery view.

## Required triggers

Run this skill before continuing after any of these events:

- Creating or editing any file under the active `docs/logs/<timestamp>-<slug>/` directory
- A review-response commit (Crit or PR review comments)
- A follow-up fix commit that changes session deliverables (for example defensive-code cleanup)
- Merging `origin/main` into the session branch
- Immediately before Crit review of session artifacts
- Immediately before Publish

Do not skip a trigger because the change felt small. A commit that changes behavior without an artifact sync leaves the session record stale.

## Sync workflow

1. Identify the active session directory and open `transcript.md`.
2. Compare session reality with each existing artifact:
   - purpose and scope in the transcript header;
   - design decisions and components;
   - implementation plan tasks and constraints;
   - completion checklist deliverables and verification results;
   - specification-review status and deliverables when that file exists.
3. Update every outdated record in positive terms that state what is now true.
4. Refresh the transcript Artifact List so it lists every created or changed session path.
5. Append a short transcript entry for the sync event (review fix, follow-up fix, merge, pre-crit, or pre-publish).
6. Check baseline conflicts: if an artifact path was already modified in the recorded baseline, stop, record the conflict, and ask for direction. Do not overwrite baseline work.
7. Record the completion result: which artifacts were updated, which were already current, and the next permitted action.

## Completion record

Each sync must leave a clear result in the conversation or transcript entry:

- `status: synced`, `blocked`, or `awaiting-direction`;
- trigger that required the sync;
- artifacts updated;
- artifacts already current;
- baseline conflicts, if any;
- next permitted action: `continue`, `crit`, or `publish`.

Proceed only when status is `synced` and the next permitted action matches the caller's intent.

## Blocking states

Use `blocked` when the active session directory or `transcript.md` cannot be identified.

Use `awaiting-direction` when a baseline-path conflict exists or two session directories claim to be active and the caller has not chosen one.

Do not continue to Crit or Publish while status is `blocked` or `awaiting-direction`.

## Explicit non-goals

- Running Crit
- Creating or updating the pull request
- Synchronizing plan-level decisions into `docs/development/staged-development.md` (that remains Development Plan Sync in `run-dev-session`)

## Validation scenarios

### RED

A review-fix commit lands while `design.md`, `completion-checklist.md`, and the transcript Artifact List still describe the pre-review design. The agent continues to the next task or publish without updating those records.

### GREEN

After the same review-fix commit, this skill updates the design and checklist to the post-review truth, refreshes the Artifact List, appends a transcript sync entry, and only then returns `next permitted action: continue`, `crit`, or `publish`.
