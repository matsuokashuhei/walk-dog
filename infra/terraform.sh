#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TERRAFORM_IMAGE="${TERRAFORM_IMAGE:-hashicorp/terraform:1.15}"

pick() {
  local prompt="$1"
  shift
  local -a options=("$@")
  local i choice
  echo "$prompt" >&2
  for i in "${!options[@]}"; do
    printf "  %d) %s\n" "$((i + 1))" "${options[$i]}" >&2
  done
  while true; do
    read -r -p "> " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && ((choice >= 1 && choice <= ${#options[@]})); then
      echo "${options[$((choice - 1))]}"
      return
    fi
    echo "Pick a number from 1 to ${#options[@]}." >&2
  done
}

PROVIDER="$(pick "provider:" aws cloudflare)"
ENV="$(pick "env:" local dev prod)"
COMMAND="$(pick "command:" init plan apply)"
MODE="$(pick "mode:" run dry-run)"

WORKSPACE_HOST="$ROOT/$PROVIDER"
WORK_DIR="/workspace/envs/$ENV"
ENV_DIR="$WORKSPACE_HOST/envs/$ENV"

if [[ ! -d "$ENV_DIR" ]]; then
  echo "missing env dir: $ENV_DIR" >&2
  exit 1
fi

if [[ ! -f "$ROOT/.env.aws" ]]; then
  echo "missing $ROOT/.env.aws (see infra/README.md)" >&2
  exit 1
fi

DOCKER_ARGS=(
  run --rm
  -v "$WORKSPACE_HOST:/workspace"
  -w "$WORK_DIR"
  --env-file "$ROOT/.env.aws"
)

if [[ "$PROVIDER" == "cloudflare" ]]; then
  if [[ ! -f "$ROOT/.env.cloudflare" ]]; then
    echo "missing $ROOT/.env.cloudflare (see infra/README.md)" >&2
    exit 1
  fi
  DOCKER_ARGS+=(--env-file "$ROOT/.env.cloudflare")
fi

TF_ARGS=("$COMMAND")
if [[ "$COMMAND" == "apply" ]]; then
  TF_ARGS+=(-auto-approve)
fi

print_cmd() {
  printf 'docker run --rm \\\n'
  printf '  -v %q:/workspace \\\n' "$WORKSPACE_HOST"
  printf '  -w %q \\\n' "$WORK_DIR"
  printf '  --env-file %q \\\n' "$ROOT/.env.aws"
  if [[ "$PROVIDER" == "cloudflare" ]]; then
    printf '  --env-file %q \\\n' "$ROOT/.env.cloudflare"
  fi
  printf '  %q' "$TERRAFORM_IMAGE"
  local arg
  for arg in "${TF_ARGS[@]}"; do
    printf ' %q' "$arg"
  done
  printf '\n'
}

print_cmd

if [[ "$MODE" == "dry-run" ]]; then
  exit 0
fi

exec docker "${DOCKER_ARGS[@]}" "$TERRAFORM_IMAGE" "${TF_ARGS[@]}"
