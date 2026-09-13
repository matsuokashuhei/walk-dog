# Sakura VPS API delivery plan

Developers publish a release image from main to ECR, then promote the `latest` tag onto a Sakura VPS so api and worker run the same build. The program enforces migrate before api and worker. Rollback pins a known-good commit SHA tag. PR order is `vps-dockerfile`, `vps-ecr-oidc`, `vps-publish`, `vps-compose-runbook`.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. The operator merges every PR. The stack stops at merge-ready until she lands each link bottom-up.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "docs/development/2026-09-12-sakura-vps-api-delivery-plan.md. PR ids vps-dockerfile, vps-ecr-oidc, vps-publish, vps-compose-runbook. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Operator merges. Done when all four PRs are merge-ready on the stack with clean swarm verdicts and the VPS promote how-to has been exercised against a real digest."
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/control-cli/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/references/bugbot-triage.md`
  - [ ] `git show origin/main:docs/specs/2026-09-12-sakura-vps-api-delivery-design.md`
- [ ] Arm the 30-minute audit tick. In a local session, a real terminal `/loop`. In a cloud root, a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then send the operator a status message, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] `vps-dockerfile` first from `main`.
  - [ ] `vps-ecr-oidc` after `vps-dockerfile`.
  - [ ] `vps-publish` after `vps-ecr-oidc`.
  - [ ] `vps-compose-runbook` after `vps-publish`.
- [ ] Hold the file boundaries. `vps-dockerfile` touches only `apps/api/Dockerfile`, `apps/api/.dockerignore`, and Dockerfile-focused tests under `apps/api/test/`. `vps-ecr-oidc` touches only `infra/aws/**`. `vps-publish` touches only `.github/workflows/**` and any tiny manifest helper under `apps/api/` or `.github/`. `vps-compose-runbook` touches only `apps/compose.vps.yml`, `apps/.env.vps.example`, `docs/` how-to under `docs/development/` or `apps/`, and `infra/sakura/deploy.sh`.
- [ ] Hold the review gate. `vps-compose-runbook` changes an operator-facing promote interaction. It waits for the operator's review in chat with screenshots and a video before merge. The other three PRs are not review-gated.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, with `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. One audit lane that reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner. A new head gets a fresh swarm and a fresh verdict.
- [ ] Root appends the PR to the base-branch stack. The operator lands it bottom-up. Preserve patch-id rules from `playbooks/shipping.md`.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. Drive through `control-cli` from `cursor-team-kit`.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Install Docker Engine when the lane needs containers. From `apps/api`, run the lane's build or compose commands. Wait until `docker ps` or `curl` shows ready.
- [ ] Deliver input only through `control-cli` commands. Read-only diagnostics are `docker logs`, `docker inspect`, and `curl -sS`.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Ship a release Dockerfile (vps-dockerfile)

**Depends on.** None.

**Files.**

- [ ] Edit `apps/api/Dockerfile`.
- [ ] Edit `apps/api/.dockerignore` if runtime still pulls test trees.
- [ ] Create `apps/api/test/dockerfile-release.test.ts` (or equivalent) that documents expected CMD and stages via a checked-in fixture or build script assertion the owner can run.

**Build.**

- [ ] Replace the single-stage `npm run dev` image with a multi-stage release image. Build stage runs `npm ci` and `npm run build`. Runtime stage keeps production deps, `dist/` (including `instrument.js`, `server.js`, `worker.js`), `drizzle/`, `drizzle.config.ts`, and the package files needed for `npm start`, `npm run start:worker`, and `npm run migrate`. Default CMD is api start. Do not copy `src/` or `test/` into runtime.

**You see.**

- [ ] `docker build -t walkdog-api:test apps/api` exits 0. `docker run --rm walkdog-api:test` starts the api process without `tsx watch`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/api` static gates still pass. Run `cd apps/api && npm run check`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Build `apps/api/Dockerfile` at trunk and at head. Trunk may still use `npm run dev`. Record that fact. At head, gate the release CMD and missing `tsx watch` in the running process list. Save `dockerfile-regression.png`. Pass when head image CMD is release start and the process list has no `tsx watch`.
- [ ] Lane 2. Build the head image successfully. Save `dockerfile-build.png`. Pass when `docker build` exits 0.
- [ ] Lane 3. Run the default CMD and hit a local health path after wiring a minimal env against Compose Postgres from `apps/compose.yml` (Postgres only). Save `dockerfile-api-boot.png`. Pass when the api process stays up for 10 seconds without crashing on missing modules.
- [ ] Lane 4. Override command to `npm run start:worker` and confirm the worker health port listens. Save `dockerfile-worker-boot.png`. Pass when `WORKER_HEALTH_PORT` accepts a GET.
- [ ] Lane 5. Override command to `npm run migrate` against empty Postgres and confirm exit 0 or a clear migrate log. Save `dockerfile-migrate.png`. Pass when the one-shot exits without missing `drizzle/`.
- [ ] Lane 6. Confirm runtime image has no `test/` tree. Save `dockerfile-no-tests.png`. Pass when `docker run --rm walkdog-api:test ls test` fails.
- [ ] Lane 7. Confirm runtime image has `dist/server.js` and `dist/worker.js`. Save `dockerfile-dist.png`. Pass when both paths exist.
- [ ] Lane 8. Confirm local `apps/compose.yml` still builds for `npm run dev` when using the updated Dockerfile context or document that compose keeps a dev command override. Save `dockerfile-local-compose.png`. Pass when `docker compose -f apps/compose.yml config` succeeds and api command remains a documented override.
- [ ] Lane 9. SIGTERM the api container and confirm exit within 30 seconds. Save `dockerfile-sigterm.png`. Pass when the container stops without force-kill.
- [ ] Lane 10. Rebuild with a second tag and compare image IDs for reproducibility of the Dockerfile instructions on the same commit. Save `dockerfile-rebuild.png`. Pass when both builds exit 0.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Wall time for `docker build` of `apps/api` at trunk and at head. Also record absolute budget for head-only release runtime start until process listen.
- [ ] Probe. Run three interleaved builds, trunk then head then trunk then head, on the same runner class.
- [ ] Baseline. Record the trunk build seconds first.
- [ ] Rule. Head build may be slower because of multi-stage. Fail if head build exceeds 15 minutes. Fail if api listen after `docker run` exceeds 60 seconds once deps are healthy.

**Review gate.** None. `vps-dockerfile` is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends it to the base-branch stack. The operator lands it bottom-up.

## Add ECR and GitHub OIDC IAM (vps-ecr-oidc)

**Depends on.** `vps-dockerfile`.

**Files.**

- [ ] Create `infra/aws/resources/ecr.tf`.
- [ ] Create `infra/aws/resources/github_oidc.tf` (or split role into `github_actions_ecr.tf`).
- [ ] Edit `infra/aws/resources/variables.tf` for GitHub org/repo and ECR name.
- [ ] Edit `infra/aws/envs/local` symlink set and `variables` / outputs so `terraform plan` shows the new resources.
- [ ] Edit `infra/README.md` with apply notes for ECR and OIDC.

**Build.**

- [ ] Add one ECR repository for the API image. Add an IAM OIDC provider for GitHub Actions if missing. Add a role assumable by this repository's `main` publish workflow with ECR push permissions only.

**You see.**

- [ ] `terraform plan` in `infra/aws/envs/local` (via the README docker recipe) includes ECR and the OIDC role without destroying unrelated Cognito resources unexpectedly.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `terraform fmt -check` and `terraform validate` on the aws env. Run the README docker terraform validate path.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Diff `infra/aws` at trunk and head. Trunk has no ECR. Record that. Gate head plan adds ECR and OIDC without deleting Cognito. Save `ecr-regression.png`. Pass when plan shows create for ECR and OIDC role and no destroy for Cognito user pool.
- [ ] Lane 2. `terraform fmt` clean. Save `ecr-fmt.png`. Pass when fmt reports no rewrites.
- [ ] Lane 3. `terraform validate` succeeds. Save `ecr-validate.png`. Pass when validate exits 0.
- [ ] Lane 4. Role trust policy mentions `token.actions.githubusercontent.com` and this repo. Save `ecr-trust.png`. Pass when the rendered policy JSON includes the repo claim.
- [ ] Lane 5. Role policy allows ECR push actions and denies broad `*`. Save `ecr-policy.png`. Pass when the policy is scoped to the repository ARN.
- [ ] Lane 6. ECR repository scan-on-push or tag mutability matches the design (immutable digest promote, SHA tags allowed). Save `ecr-repo.png`. Pass when repository settings match the chosen immutable digest story.
- [ ] Lane 7. Outputs expose repository URL and role ARN for the publish workflow. Save `ecr-outputs.png`. Pass when outputs are defined.
- [ ] Lane 8. README documents the apply command and required variables. Save `ecr-readme.png`. Pass when README names ECR and OIDC.
- [ ] Lane 9. Confirm no long-lived AWS keys are introduced in Terraform for GitHub. Save `ecr-no-keys.png`. Pass when no `aws_iam_access_key` resource appears.
- [ ] Lane 10. Confirm `envs/local` still uses the symlink pattern from `infra/README.md`. Save `ecr-symlinks.png`. Pass when new resource files are linked the same way as `cognito.tf`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Duration of `terraform validate` at trunk and head.
- [ ] Probe. Interleaved validate runs, trunk then head, three pairs.
- [ ] Baseline. Record trunk validate seconds first.
- [ ] Rule. Fail if head validate exceeds 3 minutes. Absolute budget only when trunk lacks the resources.

**Review gate.** None. `vps-ecr-oidc` is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends it to the base-branch stack. The operator lands it bottom-up.

## Publish release images from main (vps-publish)

**Depends on.** `vps-ecr-oidc`.

**Files.**

- [ ] Edit `.github/workflows/publish.yml`.
- [ ] Create `.github/workflows` helper or inline steps for build, OIDC login, push, and manifest artifact.
- [ ] Create `apps/api/scripts/write-release-manifest.mjs` (or equivalent) that writes commit SHA, image digest, app `info.version` from `GET /openapi.json` (today `0.1.0` in `apps/api/src/app.ts`, not the OpenAPI spec number `3.1.0`), and build time.

**Build.**

- [ ] After `api-check`, build the release Dockerfile, assume the OIDC role, push to ECR with the commit SHA tag, and upload a release manifest artifact. Do not use `latest` as the promote pin.

**You see.**

- [ ] On a dry run against a fork or `workflow_dispatch` if added, the job log shows digest and uploads `release-manifest.json`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Manifest writer unit test or node assert script. Run `node --test` (or the chosen runner) on the manifest helper.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk `publish.yml` only runs `api-check`. Record that. At head, gate presence of build, OIDC, push, and manifest steps. Save `publish-regression.png`. Pass when head workflow YAML contains those four capabilities.
- [ ] Lane 2. `actionlint` or `gh workflow view` parses the file. Save `publish-parse.png`. Pass when the workflow is valid YAML for GitHub Actions.
- [ ] Lane 3. Permissions include `id-token: write` and `contents: read`. Save `publish-perms.png`. Pass when both appear.
- [ ] Lane 4. Working directory or build context points at `apps/api`. Save `publish-context.png`. Pass when the Dockerfile path is `apps/api/Dockerfile`.
- [ ] Lane 5. Manifest includes `commitSha`, `imageDigest`, `openapiVersion`, `builtAt`. Save `publish-manifest-shape.png`. Pass when a local run of the writer emits those keys.
- [ ] Lane 6. OpenAPI version comes from `GET /openapi.json` field `info.version`. Save `publish-openapi.png`. Pass when the writer records that app version string (not the `openapi` document number alone).
- [ ] Lane 7. Image tags include the full commit SHA and do not require `latest` for promote. Save `publish-tags.png`. Pass when the push step tags SHA and the how-to in a comment points at digest.
- [ ] Lane 8. Job depends on successful `api-check`. Save `publish-gate.png`. Pass when publish needs check completion.
- [ ] Lane 9. Secrets are role assumption via OIDC, not static access keys in the workflow. Save `publish-oidc.png`. Pass when `configure-aws-credentials` (or equivalent) uses `role-to-assume`.
- [ ] Lane 10. Artifact upload path is stable for operators. Save `publish-artifact.png`. Pass when the artifact name is fixed in YAML.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Local `docker build` plus manifest write duration at head. Trunk lacks publish build, so also set absolute budgets for build and manifest write.
- [ ] Probe. Run build and manifest write three times at head. For trunk, record that publish build is absent and only time `api-check` matrix is not required on the lane VM.
- [ ] Baseline. Record trunk note first (no image publish). Then record head timings.
- [ ] Rule. Fail if head image build exceeds 15 minutes. Fail if manifest write exceeds 30 seconds.

**Review gate.** None. `vps-publish` is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends it to the base-branch stack. The operator lands it bottom-up.

## Add VPS compose and promote how-to (vps-compose-runbook)

**Depends on.** `vps-publish`.

**Files.**

- [ ] Create `apps/compose.vps.yml`.
- [ ] Create `apps/.env.vps.example`.
- [ ] Create `docs/development/2026-09-12-sakura-vps-promote.md` (how-to).

**Build.**

- [ ] Compose defines `postgres`, one-shot `migrate`, `api`, and `worker` using the release image. Example env omits `SQS_ENDPOINT` and `DYNAMODB_ENDPOINT`. How-to covers pull, migrate, api, worker, health, failure holds, and rollback to a known-good commit SHA tag.

**You see.**

- [ ] An operator can follow the how-to against a loaded image (ECR pull when credentials exist, otherwise `docker load` of the release image built in CI) and reach health success, then demonstrate rollback via commit SHA tag.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `docker compose -f apps/compose.vps.yml config` exits 0 with a dummy image reference and env file.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.6-fast-xhigh` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk has no `compose.vps.yml`. Record that. At head, gate compose services and how-to existence. Save `vps-regression.png`. Pass when compose lists postgres, migrate, api, worker and the how-to file exists.
- [ ] Lane 2. Compose config validates. Save `vps-compose-config.png`. Pass when `docker compose ... config` exits 0.
- [ ] Lane 3. Example env lists every Zod-required name from `apps/api/src/infrastructure/config/index.ts` and omits local emulator endpoints. Save `vps-env.png`. Pass when the example has Cognito, Postgres, SQS URL, DynamoDB table, worker health, ENVIRONMENT, RELEASE, and AWS keys, and does not set `SQS_ENDPOINT` or `DYNAMODB_ENDPOINT`.
- [ ] Lane 4. Promote order in the how-to is pull, migrate, api, worker, health. Save `vps-order.png`. Pass when that order appears as numbered steps.
- [ ] Lane 5. Migrate failure instructions keep the running containers. Save `vps-migrate-fail.png`. Pass when the how-to says not to advance api or worker after migrate failure.
- [ ] Lane 6. Health failure instructions roll back api then worker to a known-good commit SHA tag. Save `vps-health-fail.png`. Pass when rollback order is documented.
- [ ] Lane 7. Boot postgres, migrate, api, worker with a release image on the lane VM (build locally if ECR is unavailable) and curl health until success. Save `vps-health-ok.png`. Pass when health returns success JSON.
- [ ] Lane 8. Simulate migrate failure with a bad command override and confirm api or worker image id is unchanged. Save `vps-hold.png`. Pass when running containers keep the prior image.
- [ ] Lane 9. Roll back to a known-good commit SHA tag and recheck health. Save `vps-rollback.png`. Pass when health succeeds on that tag.
- [ ] Lane 10. Confirm how-to forbids GitHub Actions SSH deploy and TLS setup in this delivery. Save `vps-scope.png`. Pass when those exclusions are explicit.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from compose up (after image present) until health success at head. Trunk lacks the feature, so also set absolute budgets for migrate duration and end-to-end ready.
- [ ] Probe. Interleaved? Trunk cannot run the scenario. Run the head ready probe three times. Record trunk absence first.
- [ ] Baseline. Record trunk absence. Then record head ready seconds.
- [ ] Rule. Fail if head ready exceeds 5 minutes after image is local. Fail if migrate exceeds 2 minutes on empty Postgres.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 7 screenshots into `docs/development/media/vps-compose-runbook-review-health.png`.
- [ ] Record a 30 to 60 second video of promote then rollback on a lane VM. Save it as `docs/development/media/vps-compose-runbook-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk after the verdict, patch-id unchanged.
- [ ] Root appends it to the base-branch stack. The operator lands it bottom-up.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

No prototype runs. Remaining questions were product choices settled in the approved design at `docs/specs/2026-09-12-sakura-vps-api-delivery-design.md` (sections 1 to 4). Unproven until execution is live ECR apply in the real AWS account and the first Sakura VPS promote with production Cognito and queue URLs.

## Appendix B. Alternatives rejected

- Manual-only VPS bootstrap without ECR. Rejected because it diverges from staged-development and forces a rewrite for digest promote.
- Phased temporary `docker load` as the lasting path. Rejected for this program because the operator chose the full approved pipeline in one delivery. Temporary load remains only a lane fallback when ECR credentials are missing on a verifier VM.
- Autopilot-full with owner merges. Rejected because the work is sequenced and the operator keeps landing authority.

## Appendix C. Risks

- AWS account apply for ECR or OIDC may need manual approval outside the repo. Lands in `vps-ecr-oidc`. Owner watches `terraform plan` for unrelated destroys.
- First VPS host prep (Docker, firewall, env file) is outside app code. Lands in `vps-compose-runbook` docs. Owner watches that live lanes can still prove compose with a local image.
- Local `apps/compose.yml` must keep working with the new Dockerfile. Lands in `vps-dockerfile`. Owner watches lane 8.
- Manifest OpenAPI version source must stay stable as `info.version`. Lands in `vps-publish`. Owner watches the writer against `GET /openapi.json`.

## Appendix D. Links and reading list

- Spec `docs/specs/2026-09-12-sakura-vps-api-delivery-design.md`
- R0 design `docs/specs/2026-07-26-hono-api-r0-design.md`
- Staged plan `docs/development/staged-development.md`
- `how` on `apps/api` Docker and `.github/workflows/publish.yml` before `vps-dockerfile` and `vps-publish`
- `interrogate` if publish OIDC trust or migrate-before-api ordering is contested during implementation
- Decision trail per `pstack/skills/show-me-your-work/SKILL.md` during autopilot-stack
