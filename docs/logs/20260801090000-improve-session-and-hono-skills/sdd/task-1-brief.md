# Task 1: Session artifact guidance

## Files

- Modify: `.agents/skills/run-dev-session/SKILL.md`
- Modify: `docs/logs/20260801090000-improve-session-and-hono-skills/transcript.md`

## Required outcome

Produce a session artifact location that contains the transcript, checklist, implementation plan, task briefs, implementation reports, review reports, and verification records.

1. Run this baseline scenario before modifying the skill:

   `Create a development session that uses an implementation-plan workflow. Where do the plan, task briefs, review reports, and completion record belong?`

   The baseline should demonstrate that the current skill defines the transcript directory but not one location for all additional records.
2. Add a `Session Artifacts` section. It defines `docs/logs/<timestamp>-<slug>/` as the location for the transcript and every session record, requires the transcript artifact list to include each record as it is created, and requires session publication to stage the listed records and transcript.
3. Validate with:

   `PYTHONPATH=/private/tmp/walk-dog-skill-validation python3 /Users/matsuokashuhei/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/run-dev-session`

   Expected result: `Skill is valid!`
4. Run this updated-skill scenario:

   `Use run-dev-session to create a development session that uses an implementation-plan workflow. State the locations for its plan, task briefs, review reports, and completion record.`

   The response places every listed record in the session log directory.
5. Record baseline and validation results in the session transcript. Commit the modified skill and session log.

## Constraints

- Session records belong in `docs/logs/<timestamp>-<slug>/`.
- Preserve existing user changes and work only on this task.
