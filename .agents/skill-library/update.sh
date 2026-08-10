#!/bin/bash
set -euo pipefail

LIBRARY_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOSITORY_DIR="$(cd "$LIBRARY_DIR/../.." && pwd)"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

RSYNC_OPTS="-a"
if $DRY_RUN; then
  RSYNC_OPTS="$RSYNC_OPTS --dry-run"
fi

sync_skills() {
  local source_directory="$1" destination_directory="$2" pattern="$3"
  mkdir -p "$destination_directory"
  for skill_directory in "$source_directory"/$pattern; do
    [ -d "$skill_directory" ] || continue
    rsync $RSYNC_OPTS "$skill_directory/" "$destination_directory/$(basename "$skill_directory")/"
  done
}

EXPO_REPOSITORY="$WORK_DIR/expo-skills"
git clone --depth 1 https://github.com/expo/skills.git "$EXPO_REPOSITORY"
sync_skills "$EXPO_REPOSITORY/plugins/expo/skills" "$LIBRARY_DIR/mobile/expo" "expo-*"
sync_skills "$EXPO_REPOSITORY/plugins/expo/skills" "$LIBRARY_DIR/mobile/eas" "eas-*"

TERRAFORM_REPOSITORY="$WORK_DIR/hashicorp-agent-skills"
git clone --depth 1 https://github.com/hashicorp/agent-skills.git "$TERRAFORM_REPOSITORY"
sync_skills "$TERRAFORM_REPOSITORY/terraform/code-generation/skills" "$LIBRARY_DIR/infrastructure/terraform" "*"

if ! $DRY_RUN; then
  node "$REPOSITORY_DIR/scripts/agent-skills.mjs" inventory > "$REPOSITORY_DIR/skills-catalog.json"
  node "$REPOSITORY_DIR/scripts/agent-skills.mjs" sync
  node "$REPOSITORY_DIR/scripts/agent-skills.mjs" lock > "$REPOSITORY_DIR/skills-lock.json"
fi
