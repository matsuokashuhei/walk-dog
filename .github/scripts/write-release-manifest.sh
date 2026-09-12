#!/usr/bin/env bash
# openapiVersion is apps/api OpenAPI info.version (app version), not the
# OpenAPI document number (for example 3.1.0).
#
# Usage:
#   .github/scripts/write-release-manifest.sh \
#     --commit-sha <sha> \
#     --image-digest sha256:... \
#     --openapi-json <path> \
#     --built-at <iso8601> \
#     --out release-manifest.json
#
# Or pass --openapi-version <string> instead of --openapi-json.

set -euo pipefail

commit_sha=
image_digest=
openapi_json=
openapi_version=
built_at=
out=

while [ "$#" -gt 0 ]; do
  case "$1" in
    --commit-sha)
      commit_sha=$2
      shift 2
      ;;
    --image-digest)
      image_digest=$2
      shift 2
      ;;
    --openapi-json)
      openapi_json=$2
      shift 2
      ;;
    --openapi-version)
      openapi_version=$2
      shift 2
      ;;
    --built-at)
      built_at=$2
      shift 2
      ;;
    --out)
      out=$2
      shift 2
      ;;
    *)
      echo "unexpected argument: $1" >&2
      exit 1
      ;;
  esac
done

require_non_empty() {
  local name=$1
  local value=$2
  if [ -z "$value" ]; then
    echo "$name must be a non-empty string" >&2
    exit 1
  fi
}

require_non_empty commitSha "$commit_sha"
require_non_empty imageDigest "$image_digest"
require_non_empty builtAt "$built_at"
require_non_empty out "$out"

case "$image_digest" in
  sha256:*) ;;
  *)
    echo "imageDigest must start with sha256:" >&2
    exit 1
    ;;
esac

if [ -z "$openapi_version" ]; then
  require_non_empty openapi-json "$openapi_json"
  openapi_version=$(jq -er '.info.version | select(type == "string" and length > 0)' "$openapi_json")
fi
require_non_empty openapiVersion "$openapi_version"

jq -n \
  --arg commitSha "$commit_sha" \
  --arg imageDigest "$image_digest" \
  --arg openapiVersion "$openapi_version" \
  --arg builtAt "$built_at" \
  '{commitSha:$commitSha,imageDigest:$imageDigest,openapiVersion:$openapiVersion,builtAt:$builtAt}' \
  >"$out"
