# Retrospective

- Session: R1 Step 1 Sign Up Mobile
- Timestamp: 20260803005130
- Status: ready-to-implement outcomes recorded
- Merged PR: https://github.com/matsuokashuhei/walk-dog/pull/33 (`1870bc95`)

## Findings

### F1: Zod schema edits skipped `defining-zod-schemas`

- Trigger: `verifyRequestSchema` used `z.string().min(1)` (original auth routes; later `session` made nullable for UNCONFIRMED Sign Up resume) while `.nonempty()` was already the project default and used in `apps/api/src/config.ts`.
- Missed behavior: User had to point out `.nonempty()` and `@` `.agents/skills/defining-zod-schemas/SKILL.md`.
- Desired behavior: Any edit to Zod schema definitions (`z.object`, `z.string`, enums, composition, metadata) reads and follows `defining-zod-schemas` before changing code.
- Skill action: Update `.agents/skills/run-dev-session/SKILL.md` with a **REQUIRED SUB-SKILL** hook: when the purpose or change set includes defining or changing Zod schemas, run `defining-zod-schemas` (docs review + project defaults including `.nonempty()`).
- Outcome: **Approved and applied.** `run-dev-session` Design and Plan item 3 + Task Progress note require `defining-zod-schemas` for Zod schema edits.

### F2: Specification review marked ready without user confirmation

- Trigger: Agent set `specification-review.md` to `ready` and moved toward design without asking the user the open scope questions.
- Missed behavior: User asked whether the review had been advanced alone without questions.
- Desired behavior: `ready` only after the user confirms deliverables and open questions; otherwise stay `awaiting-confirmation`.
- Skill action: Update `.agents/skills/confirming-development-specifications/SKILL.md` — require presenting open questions to the user and receiving explicit confirmation before status becomes `ready`; agent-only judgment does not advance to `ready`.
- Outcome: **Declined** (user approved F1 only).

### F3: Unused Maestro artifacts added when gate was Build iOS Apps

- Trigger: Maestro flows and related scaffolding were committed while the completion gate was Build iOS Apps / XcodeBuildMCP.
- Missed behavior: User asked why unused artifacts were in the repository; Maestro was then removed.
- Desired behavior: Scaffold only the chosen E2E runner; when the gate is Build iOS Apps, do not add Maestro packages or `.maestro/` flows.
- Skill action: Update `.agents/skills/run-dev-session/SKILL.md` — when an automated E2E gate runner is chosen, add only that runner’s artifacts; do not add alternate runners “just in case.”
- Outcome: **Declined** (user approved F1 only).

### F4: Local email regex instead of Zod `z.email()`

- Trigger: Sign Up pre-submit used a hand-rolled `isValidEmail` regex while the API already validates with Zod `z.email()`, and mobile had no direct Zod dependency.
- Missed behavior: User asked whether an installed package already covered email format validation.
- Desired behavior: Email format checks use `z.email()` via Zod 4 as a direct app dependency (aligned with API), using `safeParse` at the call site.
- Skill action: Update `.agents/skills/defining-zod-schemas/SKILL.md` project defaults — when app code needs email format validation, use `z.email()` and add `zod` as a direct dependency if missing; do not invent local email regex helpers. Cross-ref `$parsing-zod-data` for `safeParse`.
- Outcome: **Declined** (user approved F1 only).

### F5: Cognito Admin API used where public API suffices (no IAM in Docker)

- Trigger: UNCONFIRMED Sign Up resume called `AdminGetUser`, which needs IAM credentials the local API container does not have, causing 500.
- Missed behavior: Live failure forced a switch to public `ResendConfirmationCode` (success → UNCONFIRMED resume; `InvalidParameterException` → confirmed → 409).
- Desired behavior: Client-facing Cognito flows that run without IAM use public Cognito APIs; Admin* commands only when credentials are available and Admin semantics are required.
- Skill action: Update `.agents/skills/aws-cognito/SKILL.md` — document UNCONFIRMED same-email Sign Up resume via `ResendConfirmationCode`; state that Admin* APIs require IAM and must not be assumed available in the local Docker API.
- Outcome: **Declined** (user approved F1 only).

## Follow-up PR

Land this retrospective and the approved F1 skill edit on `main`.
