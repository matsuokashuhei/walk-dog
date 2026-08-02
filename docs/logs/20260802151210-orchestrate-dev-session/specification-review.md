# Specification review

- status: ready
- purpose: Refocus `run-dev-session` on development-session orchestration and move execution responsibilities into dedicated skills
- active release: R0（開発基盤）; this session provides agent-process guidance while the staged plan continues to govern R0 product deliverables
- next permitted action: design

## Source map

| Conclusion | Source |
| --- | --- |
| R0 is active and product work proceeds in R0–R3 order | `docs/development/staged-development.md` — 進捗状況、R0–R3 |
| Process skills live under `.agents/skills/` and use scenario validation | `docs/logs/20260801090000-improve-session-and-hono-skills/skill-improvements-design.md` and `skill-improvements-plan.md` |
| Specification confirmation already has a dedicated skill and returns an explicit next action | `.agents/skills/confirming-development-specifications/SKILL.md` — Confirmation workflow、Completion record |
| Session artifact synchronization already has a dedicated skill and explicit continuation gates | `.agents/skills/syncing-session-artifacts/SKILL.md` — Sync workflow、Completion record |
| Post-merge retrospection already has a dedicated skill | `.agents/skills/retrospecting-dev-session/SKILL.md` — Workflow |
| Current session lifecycle requirements cover workspace setup, plan synchronization, task tracking, review, publication, and post-merge execution | `.agents/skills/run-dev-session/SKILL.md` — Start through After merge |
| Specification and design exploration follows questions, approach comparison, section approval, written self-review, user review, and plan transition | `superpowers:brainstorming` — Checklist、Process Flow、After the Design |
| Independent review uses a reviewer agent and evidence-based evaluation of findings | `superpowers:requesting-code-review` and `superpowers:receiving-code-review` |

This agent-process change is governed by the approved session purpose, repository-local skill history, current process skills, and the user decisions recorded in the session transcript. The files under `docs/specs/` remain the source for product behavior and API foundation work.

## Current deliverables

- `run-dev-session` defines the development-session lifecycle, state gates, and required sub-skill handoffs.
- Each extracted execution responsibility has one repository-local skill with a concrete trigger, inputs, completion state, and next permitted action.
- Existing dedicated skills keep their current responsibility and expose an orchestration-compatible result.
- Session guidance retains purpose approval, staged-plan alignment, artifact traceability, review, publication, and post-merge follow-up as observable lifecycle outcomes.
- `superpowers:brainstorming` establishes requirements, compares approaches, obtains design approvals, writes and reviews the design document, and transitions to `superpowers:writing-plans`.
- Independent review uses `superpowers:requesting-code-review` and `superpowers:receiving-code-review` and returns a review-complete result with zero unresolved findings.

## Decision classifications

| Decision | Classification | Notes |
| --- | --- | --- |
| Refactor repository-local agent skills | agent-process classification | The staged plan continues to define the approved R0–R3 capabilities and public interfaces |
| Exact skill boundaries and names | implementation-local | define in the approved session design |
| Orchestration state and handoff contract | implementation-local | define in the approved session design |

## Verification conditions

- Record a baseline scenario before editing the skills.
- Validate each created or changed skill with `quick_validate.py`.
- Re-run realistic scenarios with the revised skills and verify responsibility boundaries and lifecycle continuity.
- Verify the brainstorming transition through written-design review and `superpowers:writing-plans`.
- Verify independent review through zero unresolved findings.
- Verify that `docs/development/staged-development.md` continues to represent the approved R0–R3 product plan.
