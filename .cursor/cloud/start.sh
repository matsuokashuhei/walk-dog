#!/usr/bin/env bash
# Boot the walk/dog backend stack on every agent start.
#
# WHAT: bring up the Compose services, apply Drizzle migrations, and wait for the
#       API health endpoint.
# HOW: start the Docker daemon, `docker compose up -d`, run migrations from the
#       host against the published Postgres port, then poll /health.
# WHY: the API reports healthy only when the worker and PostgreSQL are reachable,
#      so a 200 from /health confirms the whole stack is serving.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

"$REPO_ROOT/.cursor/cloud/docker-daemon.sh"

cd "$REPO_ROOT/apps"
sudo docker compose -f compose.yml up -d --build

for _ in $(seq 1 30); do
  sudo docker compose -f compose.yml exec -T postgres \
    pg_isready -U walkdog -d walkdog >/dev/null 2>&1 && break
  sleep 2
done

(
  cd "$REPO_ROOT/apps/api-ts"
  set -a
  . "$REPO_ROOT/apps/.env.local"
  set +a
  POSTGRES_HOST=127.0.0.1 npm run migrate
)

# The API health check reports ok only when the worker is up too. The worker
# exits if DynamoDB Local was not ready on its first attempt, so bring it back
# up until /health turns 200.
for _ in $(seq 1 40); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then
    echo "backend healthy: $(curl -fsS http://localhost:3000/health)"
    break
  fi
  sudo docker compose -f compose.yml up -d worker >/dev/null 2>&1 || true
  sleep 3
done
