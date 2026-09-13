#!/bin/bash
# Deploy the Sakura VPS stack: update tracked files, pull the API image, migrate, restart services.
set -euo pipefail

exported_release_image="${RELEASE_IMAGE-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

set -a
# shellcheck disable=SC1091
source apps/.env.vps
set +a

if [[ -n "$exported_release_image" ]]; then
  RELEASE_IMAGE="$exported_release_image"
  export RELEASE_IMAGE
fi

if [[ ! "${RELEASE_IMAGE:-}" =~ ^[^[:space:]@]+@sha256:[0-9a-f]{64}$ ]]; then
  echo "RELEASE_IMAGE must be repository@sha256 followed by exactly 64 lowercase hex characters" >&2
  exit 2
fi

[[ "${DEPLOY_VALIDATE_ONLY:-}" == 1 ]] && exit 0

git pull --ff-only

AWS_ACCOUNT_ID=$(echo "$RELEASE_IMAGE" | cut -d. -f1)
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
      "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

compose=(docker compose -f apps/compose.vps.yml)
"${compose[@]}" pull api worker
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --force-recreate api worker

echo "Deploy complete."
