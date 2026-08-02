# Specification Review

- status: ready
- purpose: 開発セッションが作成した全worktreeを、フォローアップPR完了後に安全に整理する運用を `run-dev-session` に追加する。
- active release: R1（散歩記録の縦切り）; this session provides repository-local agent-process guidance outside the staged product deliverables.
- next permitted action: implementation

## Source Map

| Conclusion | Source |
| --- | --- |
| R1 remains the active product release and its capabilities, interfaces, and verification conditions remain unchanged | `docs/development/staged-development.md` — 進捗状況、R1 縦切りと未完了 R0 前提、公開インターフェース、検証 |
| Product contracts remain the source for R0 API behavior | `docs/specs/2026-07-26-hono-api-r0-design.md` — 目的、構成、HTTP API; `docs/specs/2026-07-27-r0-api-foundation-first-unit.md` — API foundation deliverables |
| Repository-local process skills define workspace creation, lifecycle gates, artifact synchronization, post-merge follow-up, and terminal cleanup handoff | `.agents/skills/run-dev-session/SKILL.md` — Start、Workspace Boundary、Session Artifacts、After merge; `.agents/skills/retrospecting-dev-session/SKILL.md` — Workflow; `.agents/skills/confirming-development-specifications/SKILL.md` — Confirmation workflow |
| Existing process decisions keep agent-process work outside the product staged plan | `docs/logs/20260802151210-orchestrate-dev-session/specification-review.md` — Decision classifications and Current deliverables; `docs/logs/20260802143514-session-improvement-skills/specification-review.md` — Decision classifications |
| Existing cleanup is provided by the finishing skill | `superpowers:finishing-a-development-branch` — Step 6: Cleanup Workspace |
| The current implementation creates worktrees and reaches `done` without a terminal cleanup handoff | `.agents/skills/run-dev-session/SKILL.md` — Execution Session step 3, Workspace Boundary, After merge step 5 |
| Multiple worktrees can belong to one session | `git worktree list --porcelain` and prior session records such as `docs/logs/20260802163519-advance-r1-just-in-time-r0/transcript.md` — Worktree and post-merge follow-up entries |

## Current Deliverables

- Each new development session records its initial workspace-local worktree and every follow-up worktree it creates.
- A session reaches `done` after all registered owned worktrees are cleaned using the existing finishing procedure.
- PR review and post-merge follow-up work continue to use their worktrees until the follow-up PR is complete.
- A worktree containing changes remains available with a concrete retry operation for cleanup.
- A merged follow-up PR enters `terminal-worktree-cleanup` before the session reaches `done`.

## Decision Classifications

| Decision | Classification | Notes |
| --- | --- | --- |
| Record every worktree created by a session | implementation-local | Add a session worktree registry to `run-dev-session` and its transcript. |
| Clean registered worktrees at terminal `done` | implementation-local | Reuse `superpowers:finishing-a-development-branch` Step 6. |
| Preserve active and changed worktrees during their valid lifecycle | implementation-local | Cleanup runs after the follow-up PR merges. |
| Keep `docs/development/staged-development.md` unchanged | outside the staged product plan | This change affects agent process behavior only. |

## Verification Conditions

- The pre-change RED scenarios demonstrate that the current lifecycle has no terminal cleanup handoff.
- The revised skill passes `quick_validate.py` and fresh GREEN scenarios.
- A clean session with initial and follow-up worktrees removes every registered owned path before `done`.
- A review-in-progress session preserves its worktrees.
- A changed worktree is preserved, no force removal is used, and a retry operation is reported.
- Existing worktrees from before this session remain outside the registry and are unchanged.
- API baseline verification remains green: 22 tests pass.

## Gaps Checked

- Release boundary: the change is classified outside the R1 product capability plan; no release order, public interface, or product verification condition changes.
- Specification preconditions: the relevant product specifications describe API behavior and do not define agent-process cleanup; no product precondition is modified.
- Implementation evidence: current `run-dev-session` owns workspace-local creation and the terminal `done` transition; the finishing skill owns the existing cleanup commands.
- Worktree ownership: the registry contains only paths created by this session, resolved under the repository workspace `.worktrees/` boundary.
