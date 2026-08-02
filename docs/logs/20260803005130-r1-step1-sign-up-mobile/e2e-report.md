# Sign Up Mobile Maestro E2E report

## Status

blocked

## Commands run

```sh
pwd
rg --files -g 'AGENTS.md' -g 'SKILL.md' -g 'e2e-codex-brief.md' -g 'run-maestro*' -g 'package.json' -g 'README.md' | sed -n '1,160p'
sed -n '1,240p' AGENTS.md
sed -n '1,260p' apps/mobile/AGENTS.md
sed -n '1,360p' apps/mobile/.maestro/README.md
set -e
printf 'mailosaur_env='
if [ -n "${MAILOSAUR_API_KEY:-}" ] && [ -n "${MAILOSAUR_SERVER_ID:-}" ] && [ -n "${MAILOSAUR_EMAIL:-}" ]; then printf 'present\n'; else printf 'missing\n'; fi
printf 'mobile_env='
if [ -f apps/mobile/.env ]; then if rg -q '^EXPO_PUBLIC_API_BASE_URL=http://127\\.0\\.0\\.1:3000$' apps/mobile/.env; then printf 'configured\n'; else printf 'present-unmatched\n'; fi; else printf 'absent\n'; fi
printf 'maestro='
if [ -x "$HOME/.maestro/bin/maestro" ]; then "$HOME/.maestro/bin/maestro" --version; else printf 'unavailable\n'; fi
printf 'api_port='
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then printf 'listening\n'; else printf 'not-listening\n'; fi
printf 'simulator='
if xcrun simctl list devices booted | rg -q 'Booted'; then printf 'booted\n'; else printf 'not-booted\n'; fi
```

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| `sign-up-invalid-email.yaml` | blocked | Required Mailosaur credentials are unavailable, so the real-API gate was not started. |
| `sign-up-success.yaml` | blocked | Required Mailosaur credentials are unavailable, so SES recipient verification and the Mailosaur OTP flow were not started. |
| `cold-start-authenticated.yaml` | blocked | The authenticated sign-up prerequisite was not established. |

## Blockers / missing secrets

- `MAILOSAUR_API_KEY`, `MAILOSAUR_SERVER_ID`, and `MAILOSAUR_EMAIL` are not present in the process environment.
- No local secret file supplying these values was found.
- The required Maestro executable at `~/.maestro/bin/maestro` is unavailable.
- CoreSimulatorService is unavailable; `xcrun simctl list devices booted` returned a connection-refused error.

The local mobile environment is configured with the expected loopback API URL, and port 3000 is listening. Resume by supplying the three Mailosaur values, making the Maestro CLI and an iOS Simulator available, then verify the Mailosaur address in SES and run the three documented flows.

## Harness fixes

None.
