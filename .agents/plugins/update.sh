#!/bin/bash
set -euo pipefail

PLUGINS_DIR="$(cd "$(dirname "$0")" && pwd)"
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
  echo "=== [DRY RUN] Updating agent plugins ==="
else
  echo "=== Updating agent plugins ==="
fi

sync_skills() {
  local src_dir="$1" dest_dir="$2" pattern="$3"
  local count=0
  mkdir -p "$dest_dir"
  for skill_dir in "$src_dir"/$pattern; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    rsync $RSYNC_OPTS "$skill_dir/" "$dest_dir/$skill_name/" > /dev/null 2>&1
    count=$((count + 1))
  done
  echo "$count"
}

# --- Clone expo/skills ---
EXPO_REPO_DIR="$WORK_DIR/expo-skills"
echo ""
echo "Cloning expo/skills..."
git clone --depth 1 https://github.com/expo/skills.git "$EXPO_REPO_DIR"

UPSTREAM_SKILLS="$EXPO_REPO_DIR/plugins/expo/skills"
UPSTREAM_PLUGIN="$EXPO_REPO_DIR/plugins/expo"

# --- expo ---
echo ""
echo "--- expo ---"
EXPO_TARGET="$PLUGINS_DIR/expo"
count=$(sync_skills "$UPSTREAM_SKILLS" "$EXPO_TARGET/skills" "expo-*")
cp "$UPSTREAM_PLUGIN/LICENSE" "$EXPO_TARGET/LICENSE" 2>/dev/null || true
echo "  $count skill(s) checked"

# --- eas ---
echo ""
echo "--- eas ---"
EAS_TARGET="$PLUGINS_DIR/eas"
count=$(sync_skills "$UPSTREAM_SKILLS" "$EAS_TARGET/skills" "eas-*")
cp "$UPSTREAM_PLUGIN/LICENSE" "$EAS_TARGET/LICENSE" 2>/dev/null || true
echo "  $count skill(s) checked"

# --- Clone hashicorp/agent-skills ---
HASHICORP_REPO_DIR="$WORK_DIR/hashicorp-agent-skills"
echo ""
echo "Cloning hashicorp/agent-skills..."
git clone --depth 1 https://github.com/hashicorp/agent-skills.git "$HASHICORP_REPO_DIR"

# --- terraform-code-generation ---
echo ""
echo "--- terraform-code-generation ---"
TERRAFORM_SKILLS="$HASHICORP_REPO_DIR/terraform/code-generation/skills"
TERRAFORM_TARGET="$PLUGINS_DIR/terraform-code-generation"
count=$(sync_skills "$TERRAFORM_SKILLS" "$TERRAFORM_TARGET/skills" "*")
cp "$HASHICORP_REPO_DIR/LICENSE" "$TERRAFORM_TARGET/LICENSE" 2>/dev/null || true
echo "  $count skill(s) checked"

echo ""
echo "=== Done ==="
