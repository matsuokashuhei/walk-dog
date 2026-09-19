#!/bin/bash
# Deploy the Sakura VPS stack: update tracked files, pull the API image, migrate, restart caddy/api/worker.
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
"${compose[@]}" pull api worker migrate
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --force-recreate caddy api worker

echo "Deploy complete."
