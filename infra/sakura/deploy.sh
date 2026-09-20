#!/bin/bash
# Deploy the Sakura VPS stack: update tracked files, pull images, migrate, restart caddy/api/worker.
# Designed for small hosts (~512Mi RAM, no swap): stop running app containers before pull/extract,
# pull images one service at a time, then migrate and recreate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

set -a
# shellcheck disable=SC1091
source apps/.env.vps
set +a

RELEASE_REPOSITORY="${RELEASE_REPOSITORY:-967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api}"
export RELEASE_IMAGE="${RELEASE_REPOSITORY}:latest"
# Node/Drizzle migrate image published alongside the Rust api/worker image.
export MIGRATE_IMAGE="${RELEASE_REPOSITORY}:migrate"

[[ "${DEPLOY_VALIDATE_ONLY:-}" == 1 ]] && exit 0

git pull --ff-only

AWS_ACCOUNT_ID=$(echo "$RELEASE_REPOSITORY" | cut -d. -f1)
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
      "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

compose=(docker compose -f apps/compose.vps.yml)

# Keep postgres up (data + healthcheck). Free RAM before layer extract.
"${compose[@]}" stop caddy api worker || true

# Sequential pulls: migrate (~600MB) and runtime (~220MB) must not extract in parallel.
# worker uses the same RELEASE_IMAGE as api — pulling api is enough for both.
COMPOSE_PARALLEL_LIMIT=1 "${compose[@]}" pull migrate
COMPOSE_PARALLEL_LIMIT=1 "${compose[@]}" pull api

"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --force-recreate --remove-orphans caddy api worker

# Dangling layers only. Do not use `docker image prune -af` here — that deletes :migrate.
docker image prune -f >/dev/null || true

echo "Deploy complete."
