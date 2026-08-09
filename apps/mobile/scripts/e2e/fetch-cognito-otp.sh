#!/usr/bin/env bash
# Poll CloudWatch Logs for Cognito Custom Email Sender OTP entries (local E2E).
#
# Env:
#   E2E_EMAIL (required)
#   AWS_PROFILE (default: walk-dog)
#   AWS_REGION (default: ap-northeast-1)
#   COGNITO_OTP_LOG_GROUP (default: /aws/lambda/walkdog-local-custom-email-sender)
#   COGNITO_OTP_WAIT_MS (default: 60000)
set -euo pipefail

if [[ -z "${E2E_EMAIL:-}" ]]; then
  echo 'E2E_EMAIL is required' >&2
  exit 1
fi

AWS_PROFILE="${AWS_PROFILE:-walk-dog}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
COGNITO_OTP_LOG_GROUP="${COGNITO_OTP_LOG_GROUP:-/aws/lambda/walkdog-local-custom-email-sender}"
COGNITO_OTP_WAIT_MS="${COGNITO_OTP_WAIT_MS:-60000}"

started_at_ms=$(( ($(date +%s) - 30) * 1000 ))
deadline_s=$(( $(date +%s) + (COGNITO_OTP_WAIT_MS + 999) / 1000 ))

aws_cli() {
  local bin
  bin="$(type -P aws 2>/dev/null || true)"
  if [[ -n "$bin" ]]; then
    AWS_PROFILE="$AWS_PROFILE" AWS_DEFAULT_REGION="$AWS_REGION" "$bin" "$@"
  else
    docker run --rm \
      -v "${HOME}/.aws:/root/.aws" \
      -e "AWS_PROFILE=${AWS_PROFILE}" \
      -e "AWS_DEFAULT_REGION=${AWS_REGION}" \
      amazon/aws-cli "$@"
  fi
}

extract_otp() {
  E2E_EMAIL="$E2E_EMAIL" python3 -c '
import json, os, sys
email = os.environ["E2E_EMAIL"]
data = json.load(sys.stdin)
for event in reversed(data.get("events") or []):
    message = event.get("message") or ""
    start = message.find("{")
    if start < 0:
        continue
    try:
        payload = json.loads(message[start:])
    except Exception:
        continue
    if (
        payload.get("type") == "cognito.otp"
        and payload.get("email") == email
        and payload.get("code")
    ):
        sys.stdout.write(str(payload["code"]))
        raise SystemExit(0)
raise SystemExit(1)
'
}

while (( $(date +%s) < deadline_s )); do
  if otp="$(
    aws_cli logs filter-log-events \
      --log-group-name "$COGNITO_OTP_LOG_GROUP" \
      --start-time "$started_at_ms" \
      --filter-pattern '"cognito.otp"' \
      --output json | extract_otp
  )"; then
    printf '%s' "$otp"
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for OTP for ${E2E_EMAIL} in ${COGNITO_OTP_LOG_GROUP}" >&2
exit 1
