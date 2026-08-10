# Shared Agent Skills Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plugin-based and flat source storage with one categorized skill library and one shared flat discovery view for Codex, Coarse, and OpenAI.

**Architecture:** `.agents/skill-library/` holds each skill package exactly once. `skills-catalog.json` maps stable IDs to canonical relative paths and provenance. A Node.js synchronizer creates `.agents/skills/<id>` relative symbolic links and validates the catalog; all three agents use that generated directory as their repository-level discovery root.

**Tech Stack:** Git, POSIX symbolic links, Node.js built-in `node:test`, JSON, existing Agent Skills `SKILL.md` packages.

## Global Constraints

- Preserve the user's current uncommitted Expo/EAS move as migration input; do not discard or overwrite it.
- Retain every skill package's `SKILL.md`, `references/`, `scripts/`, `assets/`, and `agents/` contents.
- Use lowercase hyphenated unique IDs; the `name` frontmatter and the final directory name match exactly.
- Keep `.agents/skills/` generated and flat; edit canonical packages only under `.agents/skill-library/`.
- The removal of `.agents/plugins/` includes plugin manifests, marketplace entries, and plugin-qualified references.

---

### Task 1: Define the inventory and discovery contract

**Files:**
- Create: `skills-catalog.json`
- Create: `docs/agent-skills.md`
- Modify: `skills-lock.json`
- Test: `scripts/agent-skills.test.mjs`

**Consumes:** The existing directories `.agents/plugins/*/skills/*` and `.agents/skills/*`, including the current Expo/EAS working-tree move.

**Produces:** A complete catalog whose entries have `id`, `category`, `canonicalPath`, `source`, `sourceType`, `sourceSkillPath`, and `computedHash`; a documented discovery root and a three-agent sentinel check.

- [ ] Capture `git status --short` and inventory every `SKILL.md` under the two source locations. Classify project workflow skills as `workflow`, AWS and GitHub skills as `platform`, Hono skills as `backend`, Drizzle and Zod skills as `data`, Expo and EAS skills as `mobile`, and Terraform skills as `infrastructure`.
- [ ] Add a `node:test` fixture whose catalog contains two `expo-router` entries; expect `duplicate skill ID: expo-router`.
- [ ] Implement the catalog schema with `id`, `category`, `canonicalPath`, `source`, `sourceType`, `sourceSkillPath`, and `computedHash` for every skill.
- [ ] Document `.agents/skills/` as the shared discovery root and `.agents/skill-library/` as the only edit location.
- [ ] Verify the new test fails before a synchronizer exists: `node --test scripts/agent-skills.test.mjs`.

### Task 2: Implement and test catalog synchronization

**Files:**
- Create: `scripts/agent-skills.mjs`
- Create: `scripts/agent-skills.test.mjs`
- Modify: `.agents/skills/`

**Consumes:** `skills-catalog.json` entries and canonical skill directories.

**Produces:** `sync`, `check`, and `list` commands; a flat relative-link view that exactly matches the catalog.

- [ ] Add temporary `workflow/example/SKILL.md` and `mobile/example/SKILL.md` fixtures. Test that `sync` creates links under `skills/` and `check` rejects an unlisted link.
- [ ] Export `validateCatalog(catalog, repositoryRoot)` and `syncSkills(catalog, repositoryRoot)` from the script. `sync` manages only links in `.agents/skills/`; `check` validates canonical paths, `SKILL.md` frontmatter names, source hashes, and link-set equality without writes.
- [ ] Run `node --test scripts/agent-skills.test.mjs` and `node scripts/agent-skills.mjs check`; all unit tests pass and `check` reports migration items until Task 3 completes.
- [ ] Commit the synchronizer independently: `git commit -m "feat: add shared skill synchronizer"`.

### Task 3: Migrate canonical packages and regenerate the shared view

**Files:**
- Create: `.agents/skill-library/**/<skill>/`
- Modify: `.agents/skills/`
- Modify: `skills-catalog.json`
- Modify: `skills-lock.json`
- Delete: source-package duplicates outside `.agents/skill-library/`

**Consumes:** Every package currently under `.agents/plugins/*/skills/` and `.agents/skills/`.

**Produces:** One canonical package per ID and a generated `.agents/skills` link for every catalog entry.

- [ ] Add a fixture with `name: wrong-name`; expect `frontmatter name does not match catalog ID`.
- [ ] Move complete packages, including all resources, to `backend/hono`, `data/drizzle`, `data/zod`, `mobile/expo`, `mobile/eas`, `infrastructure/terraform`, `workflow`, or `platform` below `.agents/skill-library/`.
- [ ] Preserve the current uncommitted Expo/EAS package contents as the canonical content; do not fetch or overwrite them during the move.
- [ ] Update `skills-lock.json` paths and hashes to canonical `SKILL.md` files, then run `node scripts/agent-skills.mjs sync` and `node scripts/agent-skills.mjs check`.
- [ ] Verify with `node --test scripts/agent-skills.test.mjs`, `find .agents/skills -mindepth 1 -maxdepth 1 -type l -print | sort`, and `git diff --check`.
- [ ] Commit the migration independently: `git commit -m "refactor: organize shared agent skills"`.

### Task 4: Retire plugins and update active references

**Files:**
- Delete: `.agents/plugins/`
- Create: `.agents/skill-library/update.sh`
- Modify: active repository files containing `$hono:`, `$drizzle:`, or `$zod:` references
- Modify: `docs/agent-skills.md`

**Consumes:** Canonical package paths and unqualified catalog IDs.

**Produces:** An updater that writes canonical paths, a synchronized flat discovery view, and no active plugin mechanics.

- [ ] Add a test that searches outside `docs/logs/` and rejects `.agents/plugins/`, `$hono:`, `$drizzle:`, and `$zod:` references.
- [ ] Move the upstream updater to `.agents/skill-library/update.sh`; retain its source selection, target the canonical Expo, EAS, and Terraform directories, and invoke `node scripts/agent-skills.mjs sync` after updating.
- [ ] Remove marketplace metadata and plugin manifests. Replace active plugin-qualified references with their unqualified stable IDs; preserve historical `docs/logs/` records unchanged.
- [ ] Verify with `node --test scripts/agent-skills.test.mjs`, `node scripts/agent-skills.mjs check`, and `rg -n '\.agents/plugins/|\$(hono|drizzle|zod):' --glob '!docs/logs/**'`.
- [ ] Commit plugin retirement independently: `git commit -m "refactor: retire agent skill plugins"`.

### Task 5: Verify shared discovery for all three agents

**Files:**
- Create then delete: `.agents/skill-library/workflow/shared-skills-sentinel/SKILL.md`
- Modify: `skills-catalog.json`
- Modify: `docs/agent-skills.md`
- Test: session verification artifact

**Consumes:** The synchronized `.agents/skills/` directory.

**Produces:** Evidence that Codex, Coarse, and OpenAI load one canonical package through the same discovery view.

- [ ] Add a temporary `shared-skills-sentinel` package whose body directs the agent to return exactly `shared-skills-sentinel: loaded`; catalog it and synchronize the view.
- [ ] In a new task for each agent, send `Use the shared-skills-sentinel skill and return its marker.` Configure its repository-level root to the absolute `.agents/skills` path, then record the returned marker and settings location in `docs/agent-skills.md`.
- [ ] Remove the sentinel package and catalog entry, regenerate the view, and run `node scripts/agent-skills.mjs check`.
- [ ] Run `node --test scripts/agent-skills.test.mjs`, `node scripts/agent-skills.mjs check`, and `git diff --check`; commit the final interoperability evidence with `git commit -m "test: verify shared skill discovery"`.

## Plan Self-Review

- The catalog, canonical source, flat view, plugin retirement, upstream synchronization, and three-agent discovery have separate testable deliverables.
- The plan preserves the existing Expo/EAS work and excludes historical records from active-reference rewrites.
