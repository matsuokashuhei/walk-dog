# Specification review

- status: ready
- purpose: Add session improvement skills and wire them into run-dev-session
- active release: R0（開発基盤）; session is agent-process work outside product deliverables
- next permitted action: implementation

## Source map

| Conclusion | Source |
| --- | --- |
| Agent process skills live under `.agents/skills/` | existing skill layout; prior skill sessions |
| run-dev-session already uses REQUIRED SUB-SKILL hooks | `.agents/skills/run-dev-session/SKILL.md` |
| Product staged plan is unchanged by process skills | `docs/development/staged-development.md` (no release capability change) |
| Approved plan for three skills + wiring | Session improvement skills plan (user-approved) |

## Current deliverables

- `designing-github-actions-ci` skill
- `explaining-specifications-and-design` skill
- `retrospecting-dev-session` skill
- `run-dev-session` Design and Plan + After merge hooks

## Decision classifications

| Decision | Classification | Notes |
| --- | --- | --- |
| Skill create/update for agent process | outside the staged plan | does not change R0–R3 product capabilities |

## Verification conditions

- Each new skill has `name` and `description` frontmatter with WHEN triggers
- `run-dev-session` requires the three skills at the planned lifecycle points
- No product docs under `docs/development/staged-development.md` require change
