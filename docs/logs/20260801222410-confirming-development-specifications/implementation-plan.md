# Specification Confirmation Skill Implementation Plan

## Goal

Create a repository-local `confirming-development-specifications` skill and require it before design or implementation begins in `run-dev-session`.

## Scope

- Create `.agents/skills/confirming-development-specifications/SKILL.md`.
- Create its generated `agents/openai.yaml` metadata.
- Update `.agents/skills/run-dev-session/SKILL.md` to invoke the new skill before design work.
- Record verification scenarios and results in this session directory.

## RED baseline

A fresh read-only agent avoided adding business tables to R0, but it did not detect that `docs/specs/external-specification.html` declares a missing Markdown primary source. It also listed R1 tables as settled implementation decisions while answering an R0 task. These are the failures the new skill must prevent.

## GREEN tasks

1. Initialize the skill with `init_skill.py` and replace the template with concise repository-specific instructions.
2. Require source discovery, source-authority checks, release/scope mapping, positive contract extraction, decision classification, and a blocking status for missing or conflicting specifications.
3. Require `specification-review.md` in the active session directory and add it to the transcript artifact list.
4. Add the mandatory subskill gate to `run-dev-session`.
5. Validate the skill structure and rerun the RED scenarios with the skill applied.

## Acceptance

- The skill metadata passes `quick_validate.py`.
- A missing primary specification produces a blocked review and no design or implementation start.
- R1/R3 details are not treated as R0 deliverables without an approved plan decision.
- Plan-level changes require user confirmation and synchronization before implementation.
- The session review record includes the sources, current release, positive deliverables, decision classification, and status.
