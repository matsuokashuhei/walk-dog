#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOSITORY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPOSITORY_DIR/.agents/skills"
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
sync_skills "$EXPO_REPOSITORY/plugins/expo/skills" "$SKILLS_DIR" "expo-*"
sync_skills "$EXPO_REPOSITORY/plugins/expo/skills" "$SKILLS_DIR" "eas-*"

TERRAFORM_REPOSITORY="$WORK_DIR/hashicorp-agent-skills"
git clone --depth 1 https://github.com/hashicorp/agent-skills.git "$TERRAFORM_REPOSITORY"
sync_skills "$TERRAFORM_REPOSITORY/terraform/code-generation/skills" "$SKILLS_DIR" "*"

if ! $DRY_RUN; then
  "$REPOSITORY_DIR/scripts/agent-skills.sh" sync
fi
