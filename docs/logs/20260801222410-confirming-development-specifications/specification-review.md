# Specification Review

## Status

- Status: `ready`
- Purpose: Create and integrate the repository-local specification confirmation skill.
- Active release: R0 is in progress; this session changes development guidance and does not add an R0 product capability.
- Next permitted action: implementation of the planned skill and session-gate changes.

## Source map

| Source | Confirmed use |
| --- | --- |
| `docs/development/staged-development.md` | R0 is the active release and the staged plan is the release-scope record. |
| `docs/logs/20260801090000-improve-session-and-hono-skills/skill-improvements-plan.md` | Repository skills use baseline scenario, structural validation, updated-skill scenario, and session records. |
| `docs/logs/20260801151350-r0-postgresql-local-development/transcript.md` | The prior session exposed specification verification, R0 scope, and plan-sync failures this skill addresses. |
| `.agents/skills/run-dev-session/SKILL.md` | Development sessions create a transcript, synchronize plan decisions, and publish session artifacts. |
| `.agents/skills/skill-creator` and `superpowers:writing-skills` | Skill creation requires initialization, RED/GREEN validation, and structural validation. |

## Current deliverables

- A repository-local `confirming-development-specifications` skill.
- Required integration from `run-dev-session` before design or implementation.
- A session review record format that captures sources, positive deliverables, decision classifications, and status.
- Validation scenarios for missing primary specifications, later-release scope leakage, and unapproved plan changes.

## Decision classification

- Skill location: implementation-local to this repository; `.agents/skills`.
- Invocation: required at development-session start through `run-dev-session`.
- Review output: a dedicated `specification-review.md` in the active session directory.
- Missing or conflicting specification: blocked state with user clarification required; no inferred source precedence.
- No staged-development plan change is required for this process skill.

## Source note

`docs/specs/external-specification.html` states that a Markdown document in the same directory is the primary specification, but that Markdown file is not present in the current checkout. The new skill treats this as a blocked state for product-development sessions. It does not block this skill-guidance implementation because the current deliverables and acceptance conditions are defined by the approved plan and session-skill records above.
