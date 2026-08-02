# Verification

## Skill structure

- Manual frontmatter validation for `.agents/skills/syncing-session-artifacts`: Skill is valid! (612 words).
- Manual frontmatter validation for `.agents/skills/run-dev-session`: Skill is valid! (1079 words).
- Required sections present: Required sources, Required triggers, Sync workflow, Completion record, Blocking states, Validation scenarios.
- RED and GREEN scenarios are recorded in the skill body.

## RED/GREEN scenario

Scenario: a PR review-fix commit lands for R0 API observability (`@sentry/hono`, `--import`, child logger, isolation scope), then work continues toward publish.

### Baseline without the new skill

Evidence from `docs/logs/20260801235416-r0-api-observability/`:

- Review fixes and later defensive-code cleanups were committed.
- `transcript.md` still summarized the pre-review implementation path and did not append sync entries for each review-fix or merge event.
- Design and completion checklist lagged the post-review stack until ad-hoc cleanup.
- The agent continued after review commits without a required artifact-sync gate.

### Result with `syncing-session-artifacts`

- Required triggers include review-response commits, follow-up fix commits, merges, pre-Crit, and pre-Publish.
- The workflow requires updating outdated design/checklist/transcript records, refreshing the Artifact List, appending a sync entry, and returning `status: synced` with `continue`, `crit`, or `publish`.
- Crit and Publish in `run-dev-session` now require that sub-skill to complete first.

## `run-dev-session` integration

- Session Artifacts points to `docs/logs/<timestamp>-<slug>/` and requires `syncing-session-artifacts`.
- Artifacts and Review requires a synced result with `next permitted action: crit` before Crit.
- Publish requires a synced result with `next permitted action: publish` before staging and PR creation.
- After each review-response commit, `run-dev-session` requires another artifact sync before the next Crit round or Publish.
