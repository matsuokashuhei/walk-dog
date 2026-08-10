#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOSITORY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPOSITORY_DIR/.agents/skills"
LIBRARY_DIR="$REPOSITORY_DIR/.agents/skill-library"

skill_id() {
  sed -n 's/^name:[[:space:]]*\([^[:space:]#]*\).*/\1/p' "$1/SKILL.md" | head -n 1
}

category_for_existing_link() {
  local link="$1" relative_link category id target resolved expected
  relative_link="${link#"$LIBRARY_DIR/"}"
  category="${relative_link%/*}"
  id="${relative_link##*/}"
  target="$(readlink "$link")"
  resolved="$(cd "$(dirname "$link")/$target" && pwd -P)"
  expected="$(cd "$SKILLS_DIR/$id" && pwd -P)"
  if [ "$resolved" = "$expected" ] && [ -n "$category" ]; then
    printf '%s\t%s\n' "$id" "$category"
  fi
}

existing_categories() {
  [ -d "$LIBRARY_DIR" ] || return
  while IFS= read -r -d '' link; do
    category_for_existing_link "$link" || true
  done < <(find "$LIBRARY_DIR" -type l -print0)
}

skill_directories() {
  find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d -print0
}

relative_skill_path() {
  local category="$1" id="$2" level="$category" prefix="../../"
  while [ "$level" != "${level#*/}" ]; do
    prefix="../$prefix"
    level="${level#*/}"
  done
  printf '%sskills/%s' "$prefix" "$id"
}

sync() {
  local categories category_file directory id category link
  categories="$(mktemp)"
  trap 'rm -f "$categories"' RETURN
  existing_categories > "$categories"

  mkdir -p "$LIBRARY_DIR"
  find "$LIBRARY_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

  while IFS= read -r -d '' directory; do
    id="$(skill_id "$directory")"
    [ -n "$id" ] || { echo "missing skill name: $directory" >&2; exit 1; }
    category="$(awk -F '\t' -v id="$id" '$1 == id { print $2; exit }' "$categories")"
    category="${category:-unclassified}"
    link="$LIBRARY_DIR/$category/$id"
    mkdir -p "$(dirname "$link")"
    ln -s "$(relative_skill_path "$category" "$id")" "$link"
  done < <(skill_directories)
}

check() {
  local directory id link target resolved expected status=0
  while IFS= read -r -d '' directory; do
    id="$(skill_id "$directory")"
    if [ -z "$id" ] || [ "$(basename "$directory")" != "$id" ]; then
      echo "invalid canonical skill: $directory" >&2
      status=1
      continue
    fi
    expected="$(cd "$directory" && pwd -P)"
    link_count=0
    while IFS= read -r -d '' link; do
      target="$(readlink "$link")"
      resolved="$(cd "$(dirname "$link")/$target" && pwd -P)"
      if [ "$resolved" = "$expected" ]; then link_count=$((link_count + 1)); fi
    done < <(find "$LIBRARY_DIR" -type l -name "$id" -print0)
    if [ "$link_count" -ne 1 ]; then
      echo "expected one library link: $id" >&2
      status=1
    fi
  done < <(skill_directories)

  while IFS= read -r -d '' entry; do
    if [ ! -L "$entry" ]; then
      echo "library entry is not a link: ${entry#"$LIBRARY_DIR/"}" >&2
      status=1
      continue
    fi
    id="${entry##*/}"
    expected="$SKILLS_DIR/$id"
    target="$(readlink "$entry")"
    resolved="$(cd "$(dirname "$entry")/$target" && pwd -P)"
    if [ ! -d "$expected" ] || [ "$resolved" != "$(cd "$expected" && pwd -P)" ]; then
      echo "stale library link: ${entry#"$LIBRARY_DIR/"}" >&2
      status=1
    fi
  done < <(find "$LIBRARY_DIR" -mindepth 1 \( -type l -o -type f \) -print0)
  return "$status"
}

case "${1:-}" in
  sync) sync ;;
  check) check ;;
  list)
    find "$LIBRARY_DIR" -type l -print | sed "s#^$LIBRARY_DIR/##" | sort
    ;;
  *) echo "Usage: $0 <sync|check|list>" >&2; exit 1 ;;
esac
