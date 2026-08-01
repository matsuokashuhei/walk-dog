# Verification

## Skill structure

- `PYTHONPATH=/private/tmp/walk-dog-skill-validation python3 .../quick_validate.py .agents/skills/confirming-development-specifications`: `Skill is valid!`
- `PYTHONPATH=/private/tmp/walk-dog-skill-validation python3 .../quick_validate.py .agents/skills/run-dev-session`: `Skill is valid!`
- `wc -w .agents/skills/confirming-development-specifications/SKILL.md`: 500 words.

## RED/GREEN scenario

Scenario: begin the next R0 PostgreSQL task while the external specification is said to exist somewhere in `docs/`, decide the tables, and update the staged plan if needed.

### Baseline without the new skill

- The agent avoided adding business tables to R0.
- It did not detect that `docs/specs/external-specification.html` names a missing Markdown primary source.
- It listed R1 tables as settled decisions while answering an R0 task.

### Result with `confirming-development-specifications`

- Status was `blocked` because `2026-07-26-hono-api-r0-design.md` and the latest R0 completion log conflict about the `owners` table, and the declared primary Markdown specification is missing.
- The agent identified the current confirmed foundation deliverables and classified the R0 table choice as a plan-level decision.
- The agent asked for user confirmation and did not start design or implementation.

## `run-dev-session` integration scenario

- The session sequence was reported as purpose confirmation, baseline/worktree and transcript creation, specification review, then design or implementation only after `ready`.
- The current R0 source conflict produced `blocked`, so the integrated session did not permit design or implementation.

## Existing API baseline

- `cd apps/api && npm test`: 14 tests passed.
- `cd apps/api && npm run build`: completed successfully.
