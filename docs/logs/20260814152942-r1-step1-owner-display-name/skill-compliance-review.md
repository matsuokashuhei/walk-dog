# Skill-compliance review — Owner display name (`8bc6f67`..`a28651c`)

- **status:** CHANGES_REQUESTED
- **date:** 2026-08-14
- **reviewer:** Senior Code Reviewer ([Review](11b969d9-6d60-492a-b21c-fccfbe7b6c85))
- **model:** Cursor Grok 4.6
- **checkout:** `/Users/matsuokashuhei/Development/github.com/matsuokashuhei/walk-dog/.worktrees/agent/r1-step1-owner-display-name-20260814152942`
- **branch:** `agent/r1-step1-owner-display-name-20260814152942`
- **scope:** `AGENTS.md` + every directory under `.agents/skills/`. Diff: `git diff 8bc6f67..a28651c`
- **round:** 1

## Assessment

**Ready to merge?** With fixes  
**Skill-compliance:** CHANGES_REQUESTED  
**Critical count:** 0  
**Important count:** 2

## Important

1. PATCH `/v1/owner` route tests omit documented invalid classes (missing field, 101 characters, extra keys, malformed JSON) and do not assert the full 400/401 envelope.
2. OpenAPI test does not assert the PATCH request schema (`displayName` required, minLength 1, maxLength 100).

## Minor

1. Unused `createRegisteredOwnerApp` uses optional collaborators with throw-defaults.
2. Drizzle update docs URL is not recorded in `design.md`.
3. `specification-review.md` next action still says design/plan confirmation.
4. OpenAPI test name still says “health and auth operations”.
5. GET 200 is only asserted with `displayName: null`.
6. `OwnerProvider` returns `null` when session is missing.

Request: `docs/logs/20260814152942-r1-step1-owner-display-name/skill-compliance-review-request.md`
