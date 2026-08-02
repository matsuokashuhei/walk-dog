---
name: creating-pull-requests
description: Create and maintain pull requests with self-descriptive titles, complete descriptions, and verifiable review evidence. Use when opening a PR, updating its description, or responding to review feedback.
---

# Creating Pull Requests

## PR titles

- Titles must be self-contained and understandable without project context or session numbering.
- Do not use internal numbering such as "PR 1", "Step 1", or "Task 1" in the title — reviewers cannot map these to the project plan.
- Use concrete nouns and verbs that describe the change: "Add owners table", "Fix token refresh", "Remove deprecated endpoint".

## PR descriptions

Include these sections in the PR body:

### Changes

List every meaningful change as a bullet point with the file path and a one-line summary. Group by component or concern.

### Verification

List the verification commands run and their results:
- `npm test` — number of tests, pass/fail
- `npm run check` — lint / jscpd / knip / typecheck results

## Responding to reviews

- When a reviewer leaves inline comments, apply the change and reply with a brief resolution note.
- Push follow-up fixes as separate commits; preserve the review history.
- Update the PR description if the change set meaningfully diverges from the original description.
- Do not rewrite commit history after review has started.

## Review lifecycle

1. Open PR with a descriptive title and complete description.
2. Wait for reviewer comments.
3. Apply changes and push fixes.
4. Reply to each comment with the resolution.
5. Repeat until all comments are resolved.
