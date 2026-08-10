---
name: aws-login
description: Authenticate to AWS via SSO or IAM before running commands against AWS resources. Use before any AWS CLI or SDK operation in this project.
---

# AWS Login

## SSO login (recommended)

Login with the project's SSO profile:

```bash
aws sso login --profile walk-dog
```

This opens a browser for authentication. After success, temporary credentials are cached in `~/.aws/sso/cache/`.

## Alternative: Docker alias

If `aws` CLI is not installed locally, use the Docker alias:

```bash
alias aws='docker run --rm -ti -v ~/.aws:/root/.aws -v $(pwd):/aws amazon/aws-cli'
aws sso login --profile walk-dog
```

In non-interactive environments (CI, agents), remove the `-ti` flags:

```bash
docker run --rm -v ~/.aws:/root/.aws -v $(pwd):/aws amazon/aws-cli --profile walk-dog sso login
```

## Verify login

```bash
aws sts get-caller-identity --profile walk-dog
```

## Environment variables from Terraform outputs

After login, retrieve Cognito and other resource values from AWS:

```bash
aws cognito-idp list-user-pools --max-results 20 --region ap-northeast-1 --profile walk-dog
aws cognito-idp list-user-pool-clients --user-pool-id <pool-id> --region ap-northeast-1 --profile walk-dog
```

Export these as environment variables for local development:
- `AWS_REGION` (e.g. `ap-northeast-1`)
- `COGNITO_USER_POOL_ID` (e.g. `ap-northeast-1_xxxxx`)
- `COGNITO_CLIENT_ID` (e.g. `xxxxxxxxx`)
