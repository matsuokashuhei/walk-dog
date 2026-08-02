# Worktree Cleanup Implementation Plan

**Goal:** Add terminal worktree cleanup to the repository-local development-session process.

**Architecture:** Extend `run-dev-session` with a session-owned `Worktrees` registry and a terminal cleanup handoff, and align `retrospecting-dev-session` with that terminal state. Reuse `superpowers:finishing-a-development-branch` Step 6 for path ownership, non-forced removal, and `git worktree prune`.

**Constraints:** Preserve existing worktrees, preserve review and follow-up worktrees until terminal cleanup, keep product files and `docs/development/staged-development.md` unchanged, and preserve the original checkout baseline.

## Tasks

1. Record the implementation session, specification review, and RED pressure scenarios.
2. Update `.agents/skills/run-dev-session/SKILL.md` and `.agents/skills/retrospecting-dev-session/SKILL.md` to record all created worktree paths and route the terminal state through cleanup before `done`.
3. Run GREEN pressure scenarios for clean, active, changed, and pre-existing worktrees.
4. Run skill validation, API tests, diff checks, and review the final diff.
