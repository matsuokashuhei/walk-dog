---
name: explaining-specifications-and-design
description: Explain specifications, designs, and implementation plans in WHAT then HOW then WHY order so reviewers can judge the subject before the wiring. Use when presenting specs, design docs, or plans for approval, or when clarifying product or technical contracts. Do not use for Decision Questions that ask for a single approval; those stay in run-dev-session.
---

# Explaining Specifications and Design

Structure every user-facing specification or design explanation as WHAT, then HOW, then WHY. Lead with the subject of the change; do not open with files, path filters, or wiring.

## Lenses

| Lens | Answer |
| --- | --- |
| **WHAT** | Subject of the change: capabilities, accepted inputs, returned data or displayed states, gates, valid transitions (positive terms; follow `AGENTS.md` 文書 rules). |
| **HOW** | Mechanism: modules, workflows, commands, data flow, composition. |
| **WHY** | Reason: acceptance condition, staged-plan fit, risk, constraint, or user goal. |

## Presentation rules

1. Lead with WHAT. Do not open with wiring, path filters, file lists, or implementation choreography.
2. When the subject includes a user-facing screen, WHAT includes the HTML mockup, component list, and event list. When the subject includes an HTTP API, WHAT includes request, response, and behavior. Present these without waiting for the user to ask.
3. For quality gates or other verification work, WHAT must include a table of each check command and what it verifies before any CI or file shape.
4. HOW may include diagrams after WHAT is clear.
5. WHY ties the proposal to `docs/development/staged-development.md`, `docs/specs/`, session purpose, or an explicit constraint.
6. Keep Decision Questions (`When` … `How` in `run-dev-session`) for asking approval of an effect. This skill is for explaining the proposal itself.

## Workflow

1. Identify the audience decision (approve design, approve plan, clarify contract).
2. Draft WHAT from sources (specs, staged plan, package scripts, confirmed purpose).
3. Draft HOW only after WHAT is complete enough to judge.
4. Draft WHY as the shortest link from WHAT/HOW to acceptance or release fit.
5. When a plan is part of the approval surface, map every top-level Task to its design section, concrete deliverable, and acceptance condition. Continue to approval when every Task has all three links.
6. For documents under `docs/specs/` and `docs/development/`, audit constraint wording in its final form. State ownership, allowed dependencies, accepted inputs or states, data sources, and acceptance conditions affirmatively.
7. Present to the user in WHAT → HOW → WHY order. Put the same order at the top of design and plan documents when those documents are the approval surface.
8. After the WHAT/HOW/WHY explanation is complete, if the user must approve an effect, switch to `run-dev-session` Decision Questions. Do not use Decision Questions as a substitute for the explanation.

## Completion check

Before asking for design or plan approval, confirm:

- the user-facing summary uses WHAT → HOW → WHY in that order;
- a screen subject includes HTML mockup, component list, and event list, and an HTTP API subject includes request, response, and behavior;
- verification or gate subjects are explicit when the purpose includes quality gates or CI;
- HOW does not substitute for a missing WHAT;
- every top-level plan Task maps to a design section, deliverable, and acceptance condition;
- files under `docs/specs/` and `docs/development/` express constraints as affirmative ownership, allowed dependency, accepted input or state, data source, or acceptance condition;
- any remaining approval request uses Decision Questions only after the explanation, not instead of it.
