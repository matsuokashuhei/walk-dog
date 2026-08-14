---
name: retrospecting-dev-session
description: Use when a session pull request has merged into main, or when the user asks for a session retrospective. Do not use for product feature work unrelated to agent process.
---

# Retrospecting Dev Session

Turn user corrections and review comments into skill changes. Soft advice is not a complete outcome.

## Workflow

1. Collect evidence from the session record and the merged PR: transcript, review threads, user redirects, deferred follow-ups.
2. List each finding as trigger, missed behavior, and desired behavior.
3. Propose a skill action for every finding:
   - create or update a named skill
   - add a project convention to AGENTS.md
   - Do not add domain-skill inventories to `run-dev-session`.
4. Write `retrospective.md` in the session directory. Status is `awaiting-approval` or `ready-to-implement`.
5. Present proposals. Implement skill edits only after explicit approval.
6. Hand back to `run-dev-session` for publication and worktree cleanup.

## Quality bar

- Every finding maps to a skill create or update, or to an AGENTS.md convention change.
- Prefer the smallest change that would have prevented the correction.
- When findings share a root cause, one change may cover them; say so.

## Out of scope

- Product feature work unrelated to agent process
- Opening the follow-up PR
- Worktree cleanup
- Merging pull requests
