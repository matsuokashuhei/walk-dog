---
name: confirming-development-specifications
description: Use when starting a walk-dog development session and the active release, specification evidence, implementation scope, or plan approval must be confirmed before design or implementation.
---

# Confirming Development Specifications

Confirm the purpose against the repository specifications and release plan before design or implementation. Produce a source-backed review record and mark the session ready only when the active release, provided behavior, and plan decisions are settled.

## Required sources

Read these sources in this order:

1. `docs/development/staged-development.md` for the active release, approved foundations, capabilities, acceptance conditions, and release-start decisions.
2. The relevant files in `docs/specs/` for the product contract.
3. Related `docs/logs/` records for confirmed decisions and their final status.
4. The current implementation state for feasibility and existing behavior.

Record each source path and supporting heading, section, or log entry. The staged plan defines release scope; specifications define product behavior; logs provide decision evidence; code provides implementation evidence.

## Confirmation workflow

1. State the confirmed purpose and identify the active release.
2. Extract only the behavior needed for the purpose:
   - provided capability;
   - accepted input;
   - returned data or displayed state;
   - valid state transitions;
   - aggregation subject and source;
   - verification condition.
3. Map every extracted item to a source reference.
4. Define current-release deliverables in positive terms. Keep later-release material as a release decision reference.
5. When mapping unfinished foundations (especially R0) to later-release steps or prerequisite tables, decompose mobile foundations into separate columns or bullets:
   - mobile auth state (Cognito session hold/restore/token attachment);
   - mobile API client (OpenAPI typed client and shared error handling);
   - durable outbound queue (on-device outbox; not SQS);
   - iOS location permission (foreground/background Start and capture foundation).
   Keep Cognito API token verification, on-device auth state, durable outbound queue, and server-side SQS as distinct prerequisites.
6. Classify each new decision:
   - **Plan-level:** release order, approved foundation, capability, public interface, verification condition, or release-start decision. Synchronize it to `staged-development.md` after explicit user confirmation and before implementation.
   - **Implementation-local:** does not change the staged plan; record it in the session design or plan.
   - **Deferred release decision:** belongs to a named later release; record that release.
   - **Outside the staged plan:** record the classification and reason without changing the plan.
7. Create `docs/logs/<timestamp>-<slug>/specification-review.md` with the purpose, release, positive deliverables, source map, decision classifications, verification conditions, and confirmation status. Add it to the session transcript's Artifact List.
8. Mark the review `ready` only when current deliverables have source references, required sources exist, relevant sources agree, and no plan-level decision is awaiting confirmation.

## Delivered claims and plan tables

- Treat any “already delivered / 導入済み” conclusion as implementation evidence: record concrete repository paths (schema modules, migration SQL, workflow files, package scripts, or equivalent) in the source map. If the path is missing, keep the item as unfinished foundation or a just-in-time prerequisite.
- When the purpose adds or changes a prerequisite table in `docs/development/staged-development.md`, cross-check every cell against:
  - the staged plan’s release capability sections and later-release boundaries;
  - the relevant product preconditions in `docs/specs/`;
  - affirmative precondition labels (required / environment-specific required / not a precondition for this step).
- Do not mark `ready` while a plan table or delivered claim lacks those cross-checks.

## Decision and blocking states

Use `WHAT / WHY / HOW` when a user decision is needed. State the effect of the decision in one concise question.

Use `awaiting-confirmation` when a plan-level decision needs the user's approval. Do not begin design or implementation in this state.

Use `blocked` when a specification or declared primary document is missing, relevant sources conflict, or approval cannot establish a plan decision. Record the exact gap or conflict and ask for the smallest clarification. Do not select a source by update time or infer a product contract from implementation details.

## Completion record

The review record must include:

- `status: ready`, `awaiting-confirmation`, or `blocked`;
- active release and purpose;
- source references and supported conclusions;
- current release deliverables and acceptance conditions;
- plan-level, implementation-local, deferred, and outside-plan decisions;
- Gaps checked entries that enumerate the concrete cross-checks performed (release boundaries, specification preconditions, implementation evidence for delivered claims, and plan-table cell review when applicable);
- the next permitted action.

Proceed only when the next permitted action is explicitly `design` or `implementation`.
