# Development Session Orchestration Design

## Purpose

`run-dev-session` provides the development-session state machine. It selects the skill for the current state, passes the required inputs, validates the returned result, and advances to the permitted next state.

Repository inspection, file updates, Git and GitHub operations, task tracking, review operations, and publication are provided by dedicated skills.

## WHAT

### Lifecycle

| Current state | Skill | Accepted next state |
| --- | --- | --- |
| `purpose-undecided` | `discovering-development-purpose` | `purpose-awaiting-approval` |
| `purpose-confirmed` | `preparing-development-workspace` | `workspace-ready` |
| `workspace-ready` | `recording-development-session` | `session-recorded` |
| `session-recorded` | `confirming-development-specifications` | `specification-ready` |
| `specification-ready` | `superpowers:brainstorming` | `design-section-approval` |
| `design-section-approval` | `superpowers:brainstorming` | `design-documented` |
| `design-documented` | `superpowers:brainstorming` self-review and `syncing-session-artifacts` | `design-user-review` |
| `design-user-review` | user approval result validation | `design-approved` |
| `design-approved` | `superpowers:writing-plans` | `plan-awaiting-approval` |
| `plan-awaiting-approval` | user approval result validation | `plan-approved` |
| `plan-approved` | `tracking-development-tasks` and `superpowers:executing-plans` | `implementation-complete` |
| `implementation-complete` | `syncing-session-artifacts` and `reviewing-development-session` | `review-complete` |
| `review-complete` | `publishing-development-session` | `initial-pr-open` |
| `initial-pr-open` | merge result validation | `initial-pr-merged` |
| `initial-pr-merged` | `retrospecting-dev-session` | `retrospective-ready` |
| `retrospective-ready` | `publishing-development-follow-up` | `follow-up-pr-open` |
| `follow-up-pr-open` | merge result validation | `follow-up-pr-merged` |
| `follow-up-pr-merged` | session result validation | `done` |

A continuing session resumes from the latest completed state recorded in its session artifacts. A new or changed specification or design enters `superpowers:brainstorming` from `specification-ready`.

### Common result contract

Every lifecycle skill returns:

```yaml
status: completed | awaiting-user | blocked
artifacts:
  - path
next_permitted_action: action-name
summary: observable completed outcome
blocking:
  reason: observable state and message
  retry_action: concrete retry operation
```

`completed` returns the completed outcome and permitted next action. `awaiting-user` returns the decision effect and the state established by approval. `blocked` returns the observed state, message, and retry operation. The `blocking` value is present for a blocked result.

`run-dev-session` accepts the `status` and `next_permitted_action` pair defined for the current state and then selects the next skill.

### Dedicated responsibilities

| Skill | Input | Outcome |
| --- | --- | --- |
| `discovering-development-purpose` | Initial request and repository root | Purpose candidates with active-release context |
| `preparing-development-workspace` | Approved purpose | Baseline, slug, branch, worktree, and session ID |
| `recording-development-session` | Session context, visible messages, artifact changes, and decisions | Transcript, Artifact List, chronological messages, and decision records |
| `syncing-development-plan` | Confirmed decisions and session records | Staged-plan classification and synchronized plan result |
| `tracking-development-tasks` | Approved plan and task event | Live todo state and task progress announcement |
| `reviewing-development-session` | Synchronized review artifacts | Crit rounds, resolved comments, replies, and review completion |
| `publishing-development-session` | Review-complete session artifacts | Session commit, pushed branch, and open initial PR |
| `publishing-development-follow-up` | Merged-session retrospective artifacts | Follow-up branch, commit, push, and open follow-up PR |

Existing skills provide these outcomes:

| Skill | Outcome |
| --- | --- |
| `confirming-development-specifications` | Source-backed specification, release, decision, and verification status |
| `explaining-specifications-and-design` | WHAT → HOW → WHY design and plan presentation |
| `syncing-session-artifacts` | Aligned session records and next permitted action |
| `retrospecting-dev-session` | Post-merge findings and approved skill-action proposals |
| `superpowers:brainstorming` | Clarified requirements, compared approaches, approved design, and reviewed design document |
| `superpowers:writing-plans` | Implementation plan derived from the approved design |
| `superpowers:executing-plans` | Executed and verified implementation tasks |

## HOW

### Orchestration

For each state, `run-dev-session` defines:

1. the skill to invoke;
2. the input assembled from prior results;
3. the accepted result status;
4. the accepted next permitted action;
5. the resulting state;
6. the user-facing response for `awaiting-user` and `blocked`.

The orchestrator records no operational recipe. Each dedicated skill owns its commands, file changes, validation, completion state, and retry operation.

### Specification and design exploration

After `confirming-development-specifications` returns `specification-ready`, the orchestrator invokes `superpowers:brainstorming` with the confirmed purpose, specification review, active-release context, session directory, and artifact-recording constraints.

The brainstorming result is established through:

1. repository and specification context;
2. one decision question at a time;
3. two or three approaches with a recommendation;
4. design sections presented with `explaining-specifications-and-design` in WHAT → HOW → WHY order;
5. user approval of each design section;
6. a design document under `docs/logs/<timestamp>-<slug>/`;
7. placeholder, consistency, scope, and ambiguity self-review;
8. `recording-development-session` and `syncing-session-artifacts` results;
9. user review of the written design;
10. transition to `superpowers:writing-plans`.

The implementation plan is stored in the same session directory and becomes executable after user approval.

### Decisions and staged-plan synchronization

The orchestrator treats a user decision as a state input. `recording-development-session` records the decision and `syncing-development-plan` classifies it as plan-level, implementation-local, deferred to a named release-start decision, or outside the staged plan.

A plan-level decision reaches its next state after `syncing-development-plan` updates the matching section of `docs/development/staged-development.md` and returns the synchronized result.

### Task progress

`tracking-development-tasks` receives the approved top-level tasks and every task transition. It maintains the live todo state and returns the progress announcement. `superpowers:executing-plans` performs the approved task work and returns verification evidence to the tracker.

### Review and publication

`syncing-session-artifacts` establishes the review-ready result. `reviewing-development-session` runs Crit, resolves comments with the applicable implementation skills, replies to each comment, repeats review rounds, and returns `review-complete` when the unresolved-comment count is zero.

`publishing-development-session` stages the Artifact List and transcript, commits them with the session deliverables, pushes the session branch, and opens the initial PR against `main`.

After the initial PR merges, `retrospecting-dev-session` produces the retrospective and skill-action proposals. `publishing-development-follow-up` lands the synchronized retrospective records and approved skill changes through a follow-up PR against `main`.

## WHY

Each operational responsibility has one owner, an observable completion result, and a concrete retry operation. The lifecycle remains understandable from `run-dev-session`, while workspace handling, records, planning, task progress, review, and publication can evolve and be tested independently.

The explicit brainstorming transition makes specification and design exploration a required session outcome. The approved design becomes the source for the implementation plan, and the session directory preserves the evidence from purpose discovery through follow-up publication.

## Verification design

1. Preserve the RED baseline showing direct operational instructions in the current `run-dev-session`.
2. Run `quick_validate.py` for every created or changed skill.
3. Run a responsibility-boundary scenario and confirm that `run-dev-session` performs state selection, skill dispatch, result validation, and state transition.
4. Run a brainstorming-gate scenario from `specification-ready` through questions, approach comparison, section approval, design documentation, self-review, user review, and `superpowers:writing-plans`.
5. Run a lifecycle scenario from purpose discovery through follow-up PR merge and confirm one accepted skill result for each transition.
6. Run blocked-state scenarios for workspace preparation, specification confirmation, Crit resolution, and publication; confirm the observed state, message, and retry operation.
7. Compare transcript, specification review, design, plan, verification records, and Artifact List and confirm that every session artifact is synchronized.
