#!/usr/bin/env bash
# Prepare the walk/dog backend for a Cloud Agent (runs once to build the base).
#
# WHAT: install Docker with fuse-overlayfs, the api-ts Node dependencies, a local
#       environment file, and prebuilt Compose images.
# HOW: apt for the engine, npm ci for Node, a placeholder .env.local, then a
#       Compose build so a fresh agent starts without recompiling.
# WHY: the canonical dev flow is `docker compose up` for PostgreSQL, ElasticMQ,
#      DynamoDB Local, the API, and the worker. Baking images here keeps boot fast.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker.io docker-compose-v2 fuse-overlayfs fuse3
fi
# fuse3's postinst prompts about /etc/fuse.conf; keep the existing file and
# finish configuring any package left half-installed by the prompt.
sudo dpkg --configure -a </dev/null >/dev/null 2>&1 || true

sudo mkdir -p /etc/docker
echo '{"storage-driver":"fuse-overlayfs","features":{"containerd-snapshotter":false}}' \
  | sudo tee /etc/docker/daemon.json >/dev/null

( cd apps/api-ts && npm ci )

# Placeholder Cognito values satisfy the non-empty startup config. Real Cognito
# values are only needed for authenticated requests; /health does not use them.
if [ ! -f apps/.env.local ]; then
  cp apps/.env.example apps/.env.local
  sed -i 's/^COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=ap-northeast-1_localdev/' apps/.env.local
  sed -i 's/^COGNITO_CLIENT_ID=.*/COGNITO_CLIENT_ID=localdevclient0000000000/' apps/.env.local
fi

"$REPO_ROOT/.cursor/cloud/docker-daemon.sh"
( cd apps && sudo docker compose -f compose.yml build )
