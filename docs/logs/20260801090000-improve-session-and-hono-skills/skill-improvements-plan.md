# Skill Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Improve the session artifact and Hono Node.js initialization guidance in the repository-local skills.

**Architecture:** Update each existing skill independently. Validate the current behavior with a realistic prompt, add only the missing procedural guidance, and validate the same prompt again before starting the next skill.

**Tech Stack:** Markdown skills, Codex skill validator, fresh-context scenario validation.

## Global Constraints

- Session records belong in `docs/logs/<timestamp>-<slug>/`.
- Hono API changes begin with the applicable official Hono Docs review.
- Node.js API initialization uses the `apps/api` directory and the Hono Node.js template.
- Each modified skill passes `quick_validate.py`.

---

### Task 1: Session artifact guidance

**Files:**
- Modify: `.agents/skills/run-dev-session/SKILL.md`
- Modify: `docs/logs/20260801090000-improve-session-and-hono-skills/transcript.md`

**Produces:** A session artifact location that contains the transcript, checklist, implementation plan, task briefs, implementation reports, review reports, and verification records.

- [ ] **Step 1: Run the baseline scenario**

Prompt: `Create a development session that uses an implementation-plan workflow. Where do the plan, task briefs, review reports, and completion record belong?`

Expected baseline: the current skill defines the transcript directory but does not define one location for the additional records.

- [ ] **Step 2: Add the artifact-location recipe**

Add a `Session Artifacts` section that defines `docs/logs/<timestamp>-<slug>/` as the location for the transcript and every session record. Require the transcript artifact list to include each record as it is created. Require session publication to stage the listed records and transcript.

- [ ] **Step 3: Validate the skill structure**

Run: `PYTHONPATH=/private/tmp/walk-dog-skill-validation python3 /Users/matsuokashuhei/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/run-dev-session`

Expected: `Skill is valid!`

- [ ] **Step 4: Run the scenario with the updated skill**

Prompt: `Use run-dev-session to create a development session that uses an implementation-plan workflow. State the locations for its plan, task briefs, review reports, and completion record.`

Expected: every listed record is placed in the session log directory.

- [ ] **Step 5: Record the result and commit**

Record baseline and validation results in the transcript. Commit the modified skill and session log.

### Task 2: Hono Node.js initialization guidance

**Files:**
- Modify: `.agents/skills/developing-hono-apis/SKILL.md`
- Modify: `docs/logs/20260801090000-improve-session-and-hono-skills/transcript.md`

**Produces:** A Node.js initialization pattern that creates `apps/api` with Hono, provides development and production commands, and defines the first API contract boundaries.

- [ ] **Step 1: Run the baseline scenario**

Prompt: `Create the first Node.js Hono API in apps/api. Specify the scaffolding command, template, development command, production command, application boundary, and first public contract.`

Expected baseline: the current skill requires documentation review but does not provide the repository initialization pattern.

- [ ] **Step 2: Add the Node.js initialization recipe**

Add a `Node.js initialization` section that requires `cd apps/api`, `npm create hono@latest .`, selection of the Node.js template and npm dependencies, `tsx watch` for development, TypeScript build output for `node dist/index.js`, an application factory separate from Node startup, and health/OpenAPI/request ID/error contract tests.

- [ ] **Step 3: Validate the skill structure**

Run: `PYTHONPATH=/private/tmp/walk-dog-skill-validation python3 /Users/matsuokashuhei/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/developing-hono-apis`

Expected: `Skill is valid!`

- [ ] **Step 4: Run the scenario with the updated skill**

Prompt: `Use developing-hono-apis to create the first Node.js Hono API in apps/api. State the scaffolding command, template, scripts, application boundary, and first public contract before writing source files.`

Expected: the response follows the initialization recipe and begins with the official Hono Docs review.

- [ ] **Step 5: Record the result and commit**

Record baseline and validation results in the transcript. Commit the modified skill and session log.

## Plan Self-Review

- Coverage: Task 1 provides the session record location. Task 2 provides the Hono Node.js initialization pattern.
- Validation: each task contains a baseline scenario, structural validation, and updated-skill scenario.
- Scope: both tasks modify existing skills and session records only.
