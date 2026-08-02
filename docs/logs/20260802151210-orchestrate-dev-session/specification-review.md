# Specification review

- status: ready
- purpose: Refocus `run-dev-session` on development-session orchestration and move execution responsibilities into dedicated skills
- active release: R0（開発基盤）; this session changes agent process guidance outside the product release deliverables
- next permitted action: design

## Source map

| Conclusion | Source |
| --- | --- |
| R0 is active and product work proceeds in R0–R3 order | `docs/development/staged-development.md` — 進捗状況、R0–R3 |
| Process skills live under `.agents/skills/` and use scenario validation | `docs/logs/20260801090000-improve-session-and-hono-skills/skill-improvements-design.md` and `skill-improvements-plan.md` |
| Specification confirmation already has a dedicated skill and returns an explicit next action | `.agents/skills/confirming-development-specifications/SKILL.md` — Confirmation workflow、Completion record |
| Session artifact synchronization already has a dedicated skill and explicit continuation gates | `.agents/skills/syncing-session-artifacts/SKILL.md` — Sync workflow、Completion record |
| Post-merge retrospection already has a dedicated skill | `.agents/skills/retrospecting-dev-session/SKILL.md` — Workflow |
| `run-dev-session` currently combines orchestration with workspace setup, plan synchronization, task tracking, review, publication, and post-merge execution | `.agents/skills/run-dev-session/SKILL.md` — Start through After merge |

The files under `docs/specs/` define product behavior and API foundation work. They do not define this agent-process change.

## Current deliverables

- `run-dev-session` defines the development-session lifecycle, state gates, and required sub-skill handoffs.
- Each extracted execution responsibility has one repository-local skill with a concrete trigger, inputs, completion state, and next permitted action.
- Existing dedicated skills keep their current responsibility and expose an orchestration-compatible result.
- Session guidance retains purpose approval, staged-plan alignment, artifact traceability, review, publication, and post-merge follow-up as observable lifecycle outcomes.

## Decision classifications

| Decision | Classification | Notes |
| --- | --- | --- |
| Refactor repository-local agent skills | outside the staged plan | R0–R3 capabilities and public interfaces remain unchanged |
| Exact skill boundaries and names | implementation-local | define in the approved session design |
| Orchestration state and handoff contract | implementation-local | define in the approved session design |

## Verification conditions

- Record a baseline scenario before editing the skills.
- Validate each created or changed skill with `quick_validate.py`.
- Re-run realistic scenarios with the revised skills and verify responsibility boundaries and lifecycle continuity.
- Confirm that `docs/development/staged-development.md` requires no product-plan update.
