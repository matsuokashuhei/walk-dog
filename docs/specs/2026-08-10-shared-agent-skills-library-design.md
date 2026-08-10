# Shared Agent Skills Library Design

## WHAT

The repository provides one categorized skill library that Codex, Coarse, and OpenAI use through the same flat `.agents/skills/` discovery directory. Every skill has one canonical directory, a stable unqualified skill ID, and an inventory record that identifies its category, provenance, and content hash.

`.agents/plugins/` and the local marketplace no longer provide skills. Plugin-qualified references become references to the corresponding stable unqualified skill IDs.

## HOW

`.agents/skill-library/` is the canonical tree. Its first-level categories are `workflow`, `platform`, `backend`, `data`, `mobile`, and `infrastructure`; a category can contain a technology directory and then a skill directory.

`.agents/skills/` is a generated flat directory of relative symbolic links to canonical skill directories. `skills-catalog.json` records each skill ID, canonical relative path, category, optional upstream source, source skill path, and computed hash. A repository script regenerates this directory and validates the catalog, links, `SKILL.md` frontmatter, and duplicate IDs.

The existing `skills-lock.json` remains the lock record for upstream content and is updated from the canonical tree. The updater fetches upstream content directly into the matching canonical category, then regenerates `.agents/skills/`.

## WHY

The agents can continue to use a direct, flat discovery directory while people browse a categorized source tree. A single canonical copy eliminates divergent edits between plugin packages and direct skill directories. The catalog makes provenance and compatibility reviewable before an upstream update or a new skill is accepted.

## Acceptance Conditions

- Each canonical skill directory has one valid `SKILL.md` whose `name` matches its stable ID.
- Every catalog entry resolves to one canonical directory and one `.agents/skills/<id>` link.
- `.agents/plugins/` and its marketplace entries have no remaining repository references.
- Codex, Coarse, and OpenAI each discover and load a sentinel skill through `.agents/skills/`.
- The synchronization command detects duplicate IDs, missing frontmatter, stale links, unexpected links, and catalog/hash mismatch.
