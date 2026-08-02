# RED Pressure Scenarios — Pre-change `run-dev-session`

These scenarios are executed against the current skill before its cleanup handoff is added.

## Scenario 1: Terminal completion under time pressure

- Context: The initial PR and the follow-up PR have merged. The user asks to finish immediately.
- Owned worktrees: one initial worktree and one follow-up worktree, both clean and under `.worktrees/agent/`.
- Pressure: the session is already complete and the user wants no additional ceremony.
- Expected RED observation: the current `run-dev-session` reaches `done` after step 5 without a terminal worktree cleanup instruction.

## Scenario 2: Separate follow-up workspace

- Context: The initial PR merged, retrospective records were prepared in a new follow-up worktree, and the follow-up PR has merged.
- Owned worktrees: both the initial and follow-up paths remain registered in Git.
- Pressure: the initial branch is already merged, so cleanup of only the current directory appears sufficient.
- Expected RED observation: the current skill does not maintain a session-owned list that requires both paths to be cleaned.

## Scenario 3: Changed worktree during completion

- Context: The follow-up PR merged, but one owned worktree contains an uncommitted session record.
- Pressure: a forced removal would make the session appear complete quickly.
- Expected RED observation: the current `run-dev-session` does not define the dirty-worktree result, retry operation, or completion gate.

## Scenario 4: Existing worktree protection

- Context: Other sessions have worktrees under `.worktrees/agent/` and the current session reaches `done`.
- Pressure: a broad `git worktree prune` or merged-branch sweep appears to solve the accumulation immediately.
- Expected RED observation: the current skill does not define a registry boundary that distinguishes this session's paths from existing worktrees.

## Observed RED Results

- The current skill defines a singular `WORKTREE_PATH` during workspace setup and does not define a session-owned worktree list.
- The current After merge section reaches `done` after the follow-up PR merges without a cleanup handoff.
- The current skill has baseline and publish conflict reporting, but it has no dirty-worktree cleanup result, retry operation, or completion gate.
- A broad cleanup boundary for existing worktrees is not defined, so the current skill does not protect paths created by other sessions through an explicit registry.
