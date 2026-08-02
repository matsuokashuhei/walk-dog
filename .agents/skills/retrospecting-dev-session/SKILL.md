---
name: retrospecting-dev-session
description: After a session PR merges, retrospect user corrections and review comments, then propose skill create or update actions that prevent the same feedback. Use when a session PR is merged into main, or when the user asks for a session retrospective. Expected output is skill-based solutions, not soft advice. Do not use for product feature work unrelated to agent process.
---

# Retrospecting Dev Session

Eliminate future user corrections by turning findings into skill solutions. Soft advice such as “be more careful” is not a complete outcome.

## When to run

- After a session pull request merges into `main` (including when the user asks to merge and merge completes).
- When the user explicitly asks for a session retrospective.

## Workflow

1. Collect evidence from the active session directory and the merged PR:
   - `transcript.md` and other session records;
   - PR review threads and issue comments that corrected the agent;
   - user messages that redirected design, naming, scope, or process;
   - deferred follow-ups that existed only because the first design omitted a decision.
2. List each finding as:
   - **trigger** — what the agent did or presented;
   - **missed behavior** — what the user had to point out;
   - **desired behavior** — what should happen next time without a correction.
3. For every finding, propose a **skill action** only:
   - create a new skill under `.agents/skills/<name>/SKILL.md`;
   - update a named section of an existing skill;
   - add or tighten a `REQUIRED SUB-SKILL` hook in `run-dev-session`.
4. Write `docs/logs/<timestamp>-<slug>/retrospective.md` with findings, proposed skill paths and section intent, and status `awaiting-approval` or `ready-to-implement`. Add it to the transcript Artifact List.
5. Present the skill proposals to the user. Implement skill changes only after explicit approval.
6. After approved skill edits land (or after the user declines implementation and only the retrospective record remains), update the retrospective with outcomes and sync session artifacts via `syncing-session-artifacts`. After that sync, the next permitted action is `open-follow-up-pr`.
7. Land the retrospective (and any approved skill edits) on `main` via a follow-up PR:
   - Prefer a new branch from `origin/main` (the original session branch may already be deleted).
   - Commit `retrospective.md`, the updated transcript and Artifact List, and any approved skill file changes.
   - Push and open a follow-up PR against `main`.
8. When that follow-up PR merges (retrospective-only or including approved skill edits), the next permitted action is `done`.

## Finding quality bar

- Every finding maps to at least one skill create or update.
- Do not leave a finding as only soft advice.
- Prefer the smallest skill change that would have prevented the correction.
- When several findings share one root cause, one skill change may cover them; say so explicitly.

## Out of scope

- Product feature work unrelated to agent process
- Crit review tooling
- Merging pull requests (merge happens before or outside this skill)

## Completion check

Before closing the retrospective:

- every finding has a skill action;
- `retrospective.md` exists and is listed in the transcript Artifact List;
- proposals were presented, and any implementation waited for user approval;
- status reflects whether skill edits are still awaiting approval or already applied;
- a follow-up PR path to `main` is defined or already opened (`open-follow-up-pr` → `done`).
