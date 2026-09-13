#!/usr/bin/env bash
set -euo pipefail

WALKDOG_ROOT="${WALKDOG_ROOT:-/opt/walk-dog}"
WALKDOG_REPO_URL="${WALKDOG_REPO_URL:-https://github.com/matsuokashuhei/walk-dog.git}"
WALKDOG_REF="${WALKDOG_REF:-main}"
RELEASE_REPOSITORY="${RELEASE_REPOSITORY:-967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-api}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
DIGEST_STATE="${DIGEST_STATE:-/var/lib/walkdog/digest-state}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_SLEEP_SEC="${HEALTH_SLEEP_SEC:-2}"

COMPOSE_FILE="apps/compose.vps.yml"
ENV_FILE="apps/.env.vps"

require_tools() {
  local missing=0
  local tool
  for tool in docker git aws curl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "missing required tool: $tool" >&2
      missing=1
    fi
  done
  if ! docker compose version >/dev/null 2>&1; then
    echo "missing required tool: docker compose" >&2
    missing=1
  fi
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

ensure_repo() {
  if [[ ! -d "${WALKDOG_ROOT}/.git" ]]; then
    git clone "${WALKDOG_REPO_URL}" "${WALKDOG_ROOT}"
  fi
  cd "${WALKDOG_ROOT}"
  git fetch --tags origin
  git checkout "${WALKDOG_REF}"
  if git show-ref --verify --quiet "refs/remotes/origin/${WALKDOG_REF}"; then
    git reset --hard "origin/${WALKDOG_REF}"
  fi
}

require_env() {
  if [[ ! -f "${WALKDOG_ROOT}/${ENV_FILE}" ]]; then
    echo "missing ${WALKDOG_ROOT}/${ENV_FILE}; create it from apps/.env.vps.example" >&2
    exit 1
  fi
}

ensure_digest_state() {
  if [[ ! -f "${DIGEST_STATE}" ]]; then
    mkdir -p "$(dirname "${DIGEST_STATE}")"
    cp "${WALKDOG_ROOT}/apps/vps/digest-state.example" "${DIGEST_STATE}"
  fi
}

ecr_login_and_pull() {
  export RELEASE_IMAGE="${RELEASE_REPOSITORY}:latest"
  aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${RELEASE_REPOSITORY%%/*}"
  docker pull "${RELEASE_IMAGE}"
}

migrate() {
  cd "${WALKDOG_ROOT}"
  docker compose -f "${COMPOSE_FILE}" run --rm migrate
}

up_services() {
  cd "${WALKDOG_ROOT}"
  docker compose -f "${COMPOSE_FILE}" up -d api
  docker compose -f "${COMPOSE_FILE}" up -d worker
}

wait_health() {
  local i
  for ((i = 1; i <= HEALTH_RETRIES; i++)); do
    if curl -fsS "${HEALTH_URL}" >/dev/null; then
      return 0
    fi
    sleep "${HEALTH_SLEEP_SEC}"
  done
  echo "health check failed after ${HEALTH_RETRIES} attempts: ${HEALTH_URL}" >&2
  exit 1
}

write_digest_state() {
  local release_repository="${RELEASE_REPOSITORY}"
  set -a
  # shellcheck source=/dev/null
  . "${DIGEST_STATE}"
  set +a
  local new_digest previous_digest
  new_digest=$(docker image inspect "${RELEASE_IMAGE}" --format '{{index .RepoDigests 0}}' | sed 's/.*@//')
  previous_digest="${CURRENT_DIGEST}"
  printf 'CURRENT_DIGEST=%s\nPREVIOUS_DIGEST=%s\nRELEASE_REPOSITORY=%s\n' \
    "${new_digest}" "${previous_digest}" "${release_repository}" > "${DIGEST_STATE}"
}

require_tools
ensure_repo
require_env
ensure_digest_state
ecr_login_and_pull
migrate
up_services
wait_health
write_digest_state
