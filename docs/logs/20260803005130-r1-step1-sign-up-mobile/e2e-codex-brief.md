# Codex E2E brief — R1 Step 1 Sign Up Mobile (B2 OTP logs)

Worktree:

`/Users/matsuokashuhei/Development/walk-dog/.worktrees/agent/r1-step1-sign-up-mobile-20260803005130`

## Goal

Execute real-API Maestro E2E for Sign Up Mobile.

OTP retrieval is **B2** (not Mailosaur):
- Deploy Cognito Custom Message Lambda from `infra/aws` (local)
- OTP is logged to CloudWatch as `{ "type":"cognito.otp", "email", "code" }`
- Maestro polls via `.maestro/scripts/fetch-cognito-otp.*`

## Required scenarios

1. `.maestro/sign-up-invalid-email.yaml`
2. `.maestro/sign-up-success.yaml` with `E2E_EMAIL` = SES-verified address
3. `.maestro/cold-start-authenticated.yaml` after success

See `apps/mobile/.maestro/README.md`.

## Known env

- Cognito pool: `ap-northeast-1_JtAcxAaub` / client `43upvfsbiucgg4662phjvm8am8`
- Postgres: `postgresql://walk_dog:password@localhost:5432/walk_dog_dev`
- API: port 3000
- AWS profile: `walk-dog`
- Suggested E2E_EMAIL (SES verified in prior session): `matzuokashuhei@gmail.com` (or `matzuokashuheiii@gmail.com` if that one is verified)
- Mobile `.env`: `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000`

## Steps

1. `aws sso login --profile walk-dog` if needed
2. Terraform apply local AWS so Custom Message Lambda is attached (`infra/README.md` docker terraform workflow under `infra/aws/envs/local`)
3. Install Maestro if missing; boot iOS Simulator; run the Expo/dev client app (`com.cacheandbuffer.walkdog`)
4. Ensure API is listening on 3000
5. Run the three Maestro flows
6. Overwrite report at `docs/logs/20260803005130-r1-step1-sign-up-mobile/e2e-report.md`

## Deliverable

Report status `passed` | `failed` | `blocked` with commands, scenario table, blockers, harness fixes. Reply with only the report path.
