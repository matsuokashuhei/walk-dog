# Task 2: Hono Node.js initialization guidance

## Files

- Modify: `.agents/skills/developing-hono-apis/SKILL.md`
- Modify: `docs/logs/20260801090000-improve-session-and-hono-skills/transcript.md`

## Required outcome

Produce a Node.js initialization pattern that creates `apps/api` with Hono, provides development and production commands, and defines the first API contract boundaries.

1. Run this baseline scenario before modifying the skill:

   `Create the first Node.js Hono API in apps/api. Specify the scaffolding command, template, development command, production command, application boundary, and first public contract.`

   The baseline should show that current guidance requires documentation review and does not provide the repository initialization pattern.
2. Add a `Node.js initialization` section that requires `cd apps/api`, `npm create hono@latest .`, selection of the Node.js template and npm dependencies, `tsx watch` for development, TypeScript build output for `node dist/index.js`, an application factory separate from Node startup, and health/OpenAPI/request ID/error contract tests.
3. Validate with:

   `PYTHONPATH=/private/tmp/walk-dog-skill-validation python3 /Users/matsuokashuhei/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/developing-hono-apis`

   Expected result: `Skill is valid!`
4. Run this updated-skill scenario:

   `Use developing-hono-apis to create the first Node.js Hono API in apps/api. State the scaffolding command, template, scripts, application boundary, and first public contract before writing source files.`

   The response begins with the official Hono Docs review and follows the initialization recipe.
5. Record baseline and validation results in the session transcript. Commit the modified skill and session log.

## Constraints

- Hono API changes begin with the applicable official Hono Docs review.
- Node.js API initialization uses the `apps/api` directory and the Hono Node.js template.
- Preserve existing user changes and work only on this task.
