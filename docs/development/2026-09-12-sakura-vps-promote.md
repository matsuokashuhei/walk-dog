# Promote a release digest on the Sakura VPS

Promote one ECR image digest onto the VPS so `api` and `worker` run the same build. Run these steps on the VPS over SSH. This delivery does not include GitHub Actions SSH deploy or TLS.

## Before you start

- Docker Engine and the Compose plugin are installed on the VPS.
- You can pull from the API ECR repository.
- `apps/.env.vps` exists, is root-owned, and is readable only by the operator account that runs Compose. Start from `apps/.env.vps.example`. Leave `SQS_ENDPOINT` and `DYNAMODB_ENDPOINT` unset.
- Digest state lives outside the repo. Start from `apps/vps/digest-state.example` (for example `/var/lib/walkdog/digest-state`).
- You have the release manifest for the digest you want to run (`sha256:…` and commit SHA).

Work from the repo root. Compose file: `apps/compose.vps.yml`.

## Promote

1. Pull the digest.

   ```bash
   export RELEASE_REPOSITORY='123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-api'
   export NEW_DIGEST='sha256:…'
   export RELEASE_IMAGE="${RELEASE_REPOSITORY}@${NEW_DIGEST}"
   aws ecr get-login-password --region ap-northeast-1 \
     | docker login --username AWS --password-stdin "${RELEASE_REPOSITORY%%/*}"
   docker pull "${RELEASE_IMAGE}"
   ```

2. Run migrate as a one-shot with that digest.

   ```bash
   docker compose -f apps/compose.vps.yml run --rm migrate
   ```

   Success means exit 0 and structured logs for the applied migration version. If migrate exits non-zero, stop. Leave running `api` and `worker` on the current digest. Publish a fixed image, then start this promote from step 1 with the new digest.

3. Update `api` to the new digest and start it.

   ```bash
   docker compose -f apps/compose.vps.yml up -d api
   ```

4. Update `worker` to the same digest and start it.

   ```bash
   docker compose -f apps/compose.vps.yml up -d worker
   ```

5. Check health until it returns success.

   ```bash
   curl -fsS http://127.0.0.1:3000/health
   ```

   Ready means PostgreSQL and worker health both succeed and the response is the success JSON.

6. Update digest state only after health succeeds. Set `STATE` to your digest-state path.

   ```bash
   STATE=/var/lib/walkdog/digest-state
   set -a
   # shellcheck source=/dev/null
   . "$STATE"
   set +a
   PREVIOUS_DIGEST="$CURRENT_DIGEST"
   CURRENT_DIGEST="$NEW_DIGEST"
   printf 'CURRENT_DIGEST=%s\nPREVIOUS_DIGEST=%s\nRELEASE_REPOSITORY=%s\n' \
     "$CURRENT_DIGEST" "$PREVIOUS_DIGEST" "$RELEASE_REPOSITORY" > "$STATE"
   ```

## Roll back after a health failure

If step 5 does not become ready after you updated `api` or `worker`:

1. Stop the new containers.
2. Set `RELEASE_IMAGE` to `${RELEASE_REPOSITORY}@${PREVIOUS_DIGEST}` from digest state.
3. Start `api` on that digest, then start `worker` on that digest.
4. Confirm `GET /health` succeeds.

Do not run an automatic migration down. Rollback is image rollback only.

## Host prep (once)

- Install Docker Engine and the Compose plugin.
- Configure ECR pull credentials (separate from the GitHub Actions publish role).
- Place `apps/.env.vps` with restricted permissions.
- Place digest state and keep `CURRENT_DIGEST` / `PREVIOUS_DIGEST` accurate after each successful promote.
- Open port 3000 only to the sources that need the API.

## Out of scope for this delivery

- GitHub Actions SSH deploy to the VPS
- TLS termination, reverse proxy, and custom DNS
