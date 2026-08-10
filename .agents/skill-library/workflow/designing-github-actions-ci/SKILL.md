---
name: designing-github-actions-ci
description: Design high-quality GitHub Actions CI from official guides, including gate tables, reusable workflows, parallel jobs, low-context names, least permissions, and SHA-pinned actions. Use when designing or changing workflow files under .github/workflows, CI jobs that run those workflows, or publish pipelines implemented as workflows. Do not use when only authoring skills or docs about CI, or for application feature code unrelated to Actions.
---

# Designing GitHub Actions CI

Read the current official GitHub Actions docs before designing or changing workflows. Design WHAT each gate verifies before HOW the YAML is wired.

## Required documentation review

1. Open <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax> before changing triggers, jobs, permissions, or matrix strategy.
2. Open <https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows> when two or more callers share the same steps, or when introducing `workflow_call`.
3. Open <https://docs.github.com/en/actions/reference/security/secure-use> and <https://docs.github.com/en/actions/how-tos/secure-your-work> before setting permissions, secrets, or third-party `uses:` pins.
4. Record the documentation URLs read and the CI design decisions in the active session design, plan, or pull request description.

## Design order

Complete these in order before writing workflow YAML:

1. **WHAT** — For each gate or job, record the command, what it verifies, and the fail condition.
2. **Local vs CI** — State whether a local convenience script (for example sequential `npm run check`) differs from CI. Independent gates run in parallel on CI; do not force a single sequential script in Actions when the gates can run separately.
3. **HOW** — Callers, reusable `workflow_call`, matrix vs separate jobs, path filters, runtime version, `working-directory`.
4. **Security defaults** — Least `permissions`, pin third-party Actions to a full commit SHA with a version comment, pass only required secrets (prefer explicit secrets over broad inherit for untrusted callers).

Do not present path filters, file lists, or reusable layout before the gate WHAT table exists.

## Project defaults

- Place workflows under `.github/workflows/`.
- When two or more callers would duplicate the same install-and-gate steps, extract a reusable workflow with `on: workflow_call` and call it with `uses: ./.github/workflows/<name>.yml`.
- Prefer parallel jobs (matrix allowed) for independent static gates such as lint, jscpd, knip, and typecheck.
- Use low-context workflow and job display names (`publish`, `lint`, `pull-request`). Drop redundant qualifiers such as `Main publish` or `API quality gate`.
- Match package runtime to the Dockerfile or documented Node version for that package.
- Keep container image publish, cloud deploy identity federation, code-scanning result upload, and dependency-service E2E as separate design slices when they are not in the current purpose. When `docs/development/staged-development.md` already names a concrete mechanism, use that name only in the session design slice list.

## Workflow

| Phase | Provide |
| --- | --- |
| Documentation review | Official URLs read for syntax, reuse, and secure use. |
| Design | Gate WHAT table, local vs CI shape, reusable/parallel/naming decisions, permissions and pin strategy. |
| Implementation | Focused workflow YAML that matches the recorded design. |
| Verification | Workflow triggers, job names, SHA pins, and a successful Actions run when a PR or push exercises the change. |

## Completion check

Before reporting CI design or workflow changes complete, provide:

- documentation URLs reviewed;
- the gate WHAT table;
- reusable, parallel, and naming decisions;
- confirmation that third-party Actions use full commit SHAs;
- verification results from Actions or equivalent static review of the YAML.
