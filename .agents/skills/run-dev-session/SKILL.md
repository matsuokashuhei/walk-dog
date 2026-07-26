---
name: run-dev-session
description: Use at the start of every development session in this repository, and when running a repository development session from purpose definition through review and PR creation.
---

# Run Development Session

Run this skill for every development session. Keep one session focused on one stated purpose.

## Start

1. Derive a concise purpose and lowercase hyphenated English slug from the first user request. Ask one question only when the purpose is ambiguous.
2. Inspect `git status --short`. Record this baseline before changing files.
3. Create `agent/<slug>-<YYYYmmddHHMMSS>` from `origin/main`. Use an isolated worktree when the current checkout contains existing work.
4. Create `docs/logs/<YYYYmmddHHMMSS>-<slug>/transcript.md` with the purpose, timestamp, baseline, and an empty artifact list.
5. Append the first user request and every visible user or assistant message in chronological order.

## Purpose Boundary

Before acting, connect the action to the stated purpose and a session artifact. When a request materially changes the purpose, ask for an explicit purpose update before acting. Keep the updated purpose and reason in the transcript.

## Decision Questions

Use this format only when a user decision is needed:

1. When
2. Where
3. Who
4. What
5. Why
6. How

Place a separator after the proposal. Then ask one concise question that names the single decision to make. Form the question from the proposed decision; do not reuse a fixed sentence. Answer factual clarifications directly.

## Artifacts and Review

Maintain the artifact list in the transcript as files are created or changed. Do not modify a path that was already changed in the baseline; record the conflict and ask for direction.

Before publishing, review every session artifact with `crit`. Exclude `transcript.md` from Crit review. Wait for the reviewer to finish, address each comment, reply through Crit, and complete review rounds until no unresolved comments remain.

## Publish

1. Stage only files in the session artifact list and `transcript.md`.
2. Commit the session artifacts and log on the dedicated branch.
3. Push the branch and create an open PR against `main`.
4. Include the session log in every PR. Do not stage baseline changes or request a separate scope decision for them.

If branch creation, review, or publishing conflicts with baseline work, record the paths, reason, and restart condition in the transcript, then stop.
