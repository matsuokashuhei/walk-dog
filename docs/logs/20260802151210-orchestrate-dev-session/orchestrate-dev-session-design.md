# Development Session Orchestration Design

## Purpose

`run-dev-session` provides the development-session state machine through four responsibilities: select the skill for the current state, pass the required inputs, validate the returned result, and advance to the permitted next state.

Dedicated skills provide repository inspection, file updates, Git and GitHub operations, task tracking, review operations, and publication.

## WHAT

### Lifecycle transition matrix

This matrix is the normative lifecycle definition. A skill result is accepted when its `status` and `next_permitted_action` match the row for the current state.

| Current state | Dispatch or event | Accepted result or decision | Resulting state |
| --- | --- | --- | --- |
| `purpose-undecided` | `discovering-development-purpose` | `completed / request-purpose-approval` | `purpose-awaiting-approval` |
| `purpose-awaiting-approval` | user decision | `approve-purpose` | `purpose-confirmed` |
| `purpose-awaiting-approval` | user decision | `revise-purpose` | `purpose-undecided` |
| `purpose-confirmed` | `preparing-development-workspace` | `completed / record-session-start` | `workspace-ready` |
| `purpose-confirmed` | `preparing-development-workspace` | `blocked / retry-workspace-preparation` | `purpose-confirmed` |
| `workspace-ready` | `session-start` dispatch group | `completed / confirm-specifications` | `session-recorded` |
| `workspace-ready` | `session-start` dispatch group | `blocked / retry-session-recording` | `workspace-ready` |
| `session-recorded` | `confirming-development-specifications` | `completed / brainstorm-design` | `specification-ready` |
| `session-recorded` | `confirming-development-specifications` | `awaiting-user / request-specification-decision` | `specification-awaiting-user` |
| `session-recorded` | `confirming-development-specifications` | `blocked / retry-specification-confirmation` | `session-recorded` |
| `specification-awaiting-user` | `decision` dispatch group | `approve-specification-decision` | `session-recorded` |
| `specification-awaiting-user` | `decision` dispatch group | `provide-specification-source` | `session-recorded` |
| `specification-awaiting-user` | `decision` dispatch group | `revise-purpose` | `purpose-undecided` |
| `specification-ready` | `superpowers:brainstorming` | `completed / continue-design-exploration` | `design-exploration` |
| `specification-ready` | `superpowers:brainstorming` | `blocked / retry-design-exploration` | `specification-ready` |
| `design-exploration` | `superpowers:brainstorming` | `awaiting-user / request-design-decision` | `design-awaiting-user` |
| `design-exploration` | `superpowers:brainstorming` | `completed / request-written-design-review` | `design-user-review` |
| `design-exploration` | `superpowers:brainstorming` | `blocked / retry-design-exploration` | `design-exploration` |
| `design-awaiting-user` | `decision` dispatch group | `approve-design-section` | `design-exploration` |
| `design-awaiting-user` | `decision` dispatch group | `revise-design-section` | `design-exploration` |
| `design-user-review` | `decision` dispatch group | `approve-written-design` | `design-approved` |
| `design-user-review` | `decision` dispatch group | `revise-written-design` | `design-exploration` |
| `design-approved` | `superpowers:writing-plans` | `completed / request-plan-approval` | `plan-awaiting-approval` |
| `design-approved` | `superpowers:writing-plans` | `blocked / retry-plan-writing` | `design-approved` |
| `plan-awaiting-approval` | `decision` dispatch group | `approve-plan` | `plan-approved` |
| `plan-awaiting-approval` | `decision` dispatch group | `revise-plan` | `design-approved` |
| `plan-approved` | `task-preparation` dispatch group | `completed / execute-current-task` | `implementation-active` |
| `plan-approved` | `task-preparation` dispatch group | `blocked / retry-task-preparation` | `plan-approved` |
| `task-ready` | `task-preparation` dispatch group | `completed / execute-current-task` | `implementation-active` |
| `task-ready` | `task-preparation` dispatch group | `blocked / retry-task-preparation` | `task-ready` |
| `implementation-active` | `superpowers:executing-plans` for the current task | `completed / record-task-result` | `implementation-task-complete` |
| `implementation-active` | `superpowers:executing-plans` for the current task | `awaiting-user / request-implementation-decision` | `implementation-awaiting-user` |
| `implementation-active` | `superpowers:executing-plans` for the current task | `blocked / retry-current-task` | `implementation-active` |
| `implementation-awaiting-user` | `decision` dispatch group | `resume-current-task` | `implementation-active` |
| `implementation-awaiting-user` | `decision` dispatch group | `revise-plan` | `design-approved` |
| `implementation-task-complete` | `task-completion` dispatch group | `completed / start-next-task` | `task-ready` |
| `implementation-task-complete` | `task-completion` dispatch group | `completed / prepare-review` | `implementation-complete` |
| `implementation-task-complete` | `task-completion` dispatch group | `blocked / retry-task-result-recording` | `implementation-task-complete` |
| `implementation-complete` | `pre-review` dispatch group | `completed / request-independent-review` | `review-ready` |
| `implementation-complete` | `pre-review` dispatch group | `blocked / retry-artifact-sync` | `implementation-complete` |
| `review-ready` | `reviewing-development-session` | `completed / publish-session` | `review-complete` |
| `review-ready` | `reviewing-development-session` | `awaiting-user / request-review-decision` | `review-awaiting-user` |
| `review-ready` | `reviewing-development-session` | `blocked / retry-independent-review` | `review-ready` |
| `review-awaiting-user` | `decision` dispatch group | `apply-review-direction` | `review-ready` |
| `review-awaiting-user` | `decision` dispatch group | `revise-plan` | `design-approved` |
| `review-complete` | `initial-publication` dispatch group | `completed / await-initial-pr-merge` | `initial-pr-open` |
| `review-complete` | `initial-publication` dispatch group | `blocked / retry-initial-publication` | `review-complete` |
| `initial-pr-open` | GitHub merge event validation | `initial-pr-merged` | `initial-pr-merged` |
| `initial-pr-merged` | `retrospecting-dev-session` | `awaiting-user / request-retrospective-decision` | `retrospective-awaiting-user` |
| `initial-pr-merged` | `retrospecting-dev-session` | `blocked / retry-retrospective` | `initial-pr-merged` |
| `retrospective-awaiting-user` | `decision` dispatch group | `approve-skill-changes` | `retrospective-changes-approved` |
| `retrospective-awaiting-user` | `decision` dispatch group | `publish-retrospective-record` | `retrospective-ready` |
| `retrospective-changes-approved` | `task-preparation` dispatch group | `completed / execute-retrospective-change` | `retrospective-implementation-active` |
| `retrospective-changes-approved` | `task-preparation` dispatch group | `blocked / retry-task-preparation` | `retrospective-changes-approved` |
| `retrospective-implementation-active` | `superpowers:executing-plans` for the current approved skill change | `completed / record-retrospective-change-result` | `retrospective-change-complete` |
| `retrospective-implementation-active` | `superpowers:executing-plans` for the current approved skill change | `awaiting-user / request-retrospective-change-decision` | `retrospective-change-awaiting-user` |
| `retrospective-implementation-active` | `superpowers:executing-plans` for the current approved skill change | `blocked / retry-retrospective-change` | `retrospective-implementation-active` |
| `retrospective-change-awaiting-user` | `decision` dispatch group | `resume-retrospective-change` | `retrospective-implementation-active` |
| `retrospective-change-awaiting-user` | `decision` dispatch group | `publish-approved-results` | `retrospective-ready` |
| `retrospective-change-complete` | `task-completion` dispatch group | `completed / start-next-retrospective-change` | `retrospective-changes-approved` |
| `retrospective-change-complete` | `task-completion` dispatch group | `completed / publish-follow-up` | `retrospective-ready` |
| `retrospective-change-complete` | `task-completion` dispatch group | `blocked / retry-task-result-recording` | `retrospective-change-complete` |
| `retrospective-ready` | `follow-up-publication` dispatch group | `completed / await-follow-up-pr-merge` | `follow-up-pr-open` |
| `retrospective-ready` | `follow-up-publication` dispatch group | `blocked / retry-follow-up-publication` | `retrospective-ready` |
| `follow-up-pr-open` | GitHub merge event validation | `follow-up-pr-merged` | `follow-up-pr-merged` |
| `follow-up-pr-merged` | session result validation | `completed / finish-session` | `done` |

A continuing session resumes from the latest completed state and pending action recorded in its session artifacts. A new or changed specification or design enters `superpowers:brainstorming` from `specification-ready`.

### Result schemas

Every skill result uses one of these three schemas.

```yaml
status: completed
artifacts:
  - path
summary: observable completed outcome
next_permitted_action: action-name
```

```yaml
status: awaiting-user
artifacts:
  - path
summary: observable state awaiting a decision
next_permitted_action: request-specific-decision
decision:
  question: concise decision question
  answers:
    - name: answer-name
      effect: state established by this answer
      resume_state: resulting state declared for this current state and answer in the lifecycle matrix
      resume_inputs:
        key: preserved-value
```

```yaml
status: blocked
artifacts:
  - path
summary: observable blocked outcome
next_permitted_action: retry-specific-operation
blocking:
  state: state that remains active
  message: observed failure message
  retry_action: concrete retry operation
  retry_inputs:
    key: preserved-value
  resume_state: state restored after a successful retry
```

The orchestrator validates every required field, the current-state pairing, and the permitted action before advancing.

Existing lifecycle skills adopt the common schemas through this compatibility mapping during migration:

| Existing result | Common status | Preserved meaning |
| --- | --- | --- |
| `ready` | `completed` | specification confirmation completed |
| `synced` | `completed` | artifact synchronization completed |
| `awaiting-confirmation` | `awaiting-user` | user decision establishes the resume state |
| `awaiting-direction` | `awaiting-user` | user direction establishes the resume state |
| `blocked` | `blocked` | observed state and retry data remain active |

### Dedicated responsibilities

| Skill | Input | Outcome |
| --- | --- | --- |
| `discovering-development-purpose` | Initial request and repository root | Purpose candidates with active-release context |
| `preparing-development-workspace` | Approved purpose | Baseline, slug, branch, worktree, and session ID |
| `recording-development-session` | Session context, visible messages, artifact changes, and decisions | Transcript, Artifact List, chronological messages, and decision records |
| `syncing-development-plan` | Confirmed decisions and session records | Staged-plan classification and synchronized plan result |
| `tracking-development-tasks` | Approved plan and task event | Live todo state and task progress announcement |
| `reviewing-development-session` | Synchronized review artifacts | Independent review rounds, evaluated findings, applied fixes, responses, and review completion |
| `publishing-development-session` | Review-complete session artifacts | Session commit, pushed branch, and open initial PR |
| `publishing-development-follow-up` | Merged-session retrospective artifacts | Follow-up branch, commit, push, and open follow-up PR |

Existing skills provide these outcomes:

| Skill | Outcome |
| --- | --- |
| `confirming-development-specifications` | Source-backed specification, release, decision, and verification result |
| `explaining-specifications-and-design` | WHAT → HOW → WHY design and plan presentation |
| `syncing-session-artifacts` | Aligned session records and next permitted action |
| `retrospecting-dev-session` | Post-merge findings and approved skill-action proposals |
| `superpowers:brainstorming` | Clarified requirements, compared approaches, approved design, and reviewed design document |
| `superpowers:writing-plans` | Implementation plan derived from the approved design |
| `superpowers:executing-plans` | Executed and verified implementation tasks |

## HOW

### Orchestration

For each state, `run-dev-session` defines the dispatched skill or event, assembled input, accepted result schema, permitted action, resulting state, and user-facing response. These are its four operational responsibilities:

1. select the skill or event for the current state;
2. dispatch it with inputs from validated prior results;
3. validate the returned status, fields, and permitted action;
4. advance to the resulting state or retain the declared retry state.

Each dedicated skill owns its commands, file changes, validation, completion result, and retry operation.

### Ordered dispatch groups

Each group validates one result before dispatching the next skill.

| Group | Ordered skills | Completion action |
| --- | --- | --- |
| `session-start` | `recording-development-session` records the approved bootstrap purpose → `syncing-development-plan` classifies it → `syncing-session-artifacts` | `confirm-specifications` |
| `decision` | `recording-development-session` → `syncing-development-plan` → `syncing-session-artifacts` | decision action and resulting state declared in the lifecycle matrix |
| `artifact-change` | `recording-development-session` → `syncing-session-artifacts` | primary action declared by the caller's lifecycle matrix row |
| `task-preparation` | `tracking-development-tasks` marks the current approved task active | `execute-current-task` or `execute-retrospective-change` |
| `task-completion` | verified execution result → `tracking-development-tasks` marks the task complete → `recording-development-session` → `syncing-session-artifacts` | `start-next-task`, `prepare-review`, `start-next-retrospective-change`, or `publish-follow-up` |
| `pre-review` | `recording-development-session` → `syncing-session-artifacts` | `request-independent-review` |
| `initial-publication` | `recording-development-session` → `syncing-session-artifacts` → `publishing-development-session` | `await-initial-pr-merge` |
| `follow-up-publication` | `recording-development-session` → `syncing-session-artifacts` → `publishing-development-follow-up` | `await-follow-up-pr-merge` |

Every visible user or assistant message enters `recording-development-session` before the next primary lifecycle action. The approved bootstrap purpose is preserved as workspace-preparation input and then enters the `session-start` group for recording and classification. Every confirmed decision after session creation enters the `decision` group. Every created or changed artifact enters the `artifact-change` group or a more specific group containing the same recording and synchronization steps.

### Specification and design exploration

After `confirming-development-specifications` returns `specification-ready`, the orchestrator invokes `superpowers:brainstorming` with the confirmed purpose, specification review, active-release context, session directory, and artifact-recording constraints.

The brainstorming result is established through:

1. repository and specification context;
2. one decision question at a time;
3. two or three approaches with a recommendation;
4. design sections presented with `explaining-specifications-and-design` in WHAT → HOW → WHY order;
5. user approval or revision of each design section;
6. a design document under `docs/logs/<timestamp>-<slug>/`;
7. placeholder, consistency, scope, and ambiguity self-review;
8. `artifact-change` synchronization;
9. user approval or revision of the written design;
10. transition to `superpowers:writing-plans`.

The implementation plan is stored in the same session directory and becomes executable after user approval.

### Decisions and staged-plan synchronization

The orchestrator treats a user decision as a state input. The `session-start` group records and classifies the approved bootstrap purpose after the workspace exists. The `decision` dispatch group records every later confirmed decision and calls `syncing-development-plan`. The plan synchronization skill classifies the decision as plan-level, implementation-local, deferred release, or agent-process. It updates the matching section of `docs/development/staged-development.md` for a plan-level decision and returns the classified, synchronized result before the group resumes the primary lifecycle state.

Implementation-local, deferred release, and agent-process classifications are recorded with their positive lifecycle effect and resulting state.

### Task progress

`tracking-development-tasks` receives the approved top-level tasks and every task transition. The `task-preparation` group marks one approved task active. `superpowers:executing-plans` then performs that task and returns its status and verification evidence. The `task-completion` group records a completed result, marks the task complete, synchronizes artifacts, and selects the next declared task or review state. Approved retrospective skill changes use the same preparation, execution, and completion sequence.

### Review and publication

The `pre-review` group establishes the review-ready result. `reviewing-development-session` uses `superpowers:requesting-code-review` for an independent review and `superpowers:receiving-code-review` to evaluate each finding against repository evidence. It applies confirmed fixes with the applicable implementation skills, records the response to each finding, repeats review rounds, and returns `review-complete` when the unresolved-finding count is zero.

The `initial-publication` group synchronizes the session record, stages the Artifact List and transcript, commits the session deliverables, pushes the session branch, and opens the initial PR against `main`.

After the initial PR merges, `retrospecting-dev-session` produces the retrospective and skill-action proposals. The `follow-up-publication` group synchronizes and lands the retrospective records and approved skill changes through a follow-up PR against `main`.

## WHY

Each operational responsibility has one owner, an observable completion result, and a concrete retry operation. The lifecycle remains understandable from `run-dev-session`, while workspace handling, records, planning, task progress, review, and publication can evolve and be tested independently.

The explicit brainstorming transition makes specification and design exploration a required session outcome. The approved design becomes the source for the implementation plan, and the session directory preserves the evidence from purpose discovery through follow-up publication.

## Verification design

1. Preserve the RED baseline showing direct operational instructions in the current `run-dev-session`.
2. Run `quick_validate.py` for every created or changed skill.
3. Validate the complete transition matrix: every declared state is reachable, every reachable state has an approval, revision, retry, or completion transition, and every resulting state is declared.
4. Validate every result schema field and confirm that each status/action pair, current state, and resume state matches a declared transition; a mismatch returns an observable blocked result and retry operation.
5. Run a responsibility-boundary scenario and confirm that `run-dev-session` performs its four orchestration responsibilities.
6. Run a brainstorming-gate scenario from `specification-ready` through questions, approach comparison, section approval and revision, design documentation, self-review, written-design approval and revision, and `superpowers:writing-plans`.
7. Run lifecycle scenarios for approval paths, revision loops, `awaiting-user` resume, blocked retry with preserved inputs, initial PR merge, retrospective choices, follow-up PR merge, and `done`.
8. Validate every ordered dispatch group, including per-step result validation, message recording, plan-level decision synchronization, artifact synchronization, and completion action.
9. Compare transcript, specification review, design, plan, verification records, and Artifact List and confirm that every session artifact is synchronized.
