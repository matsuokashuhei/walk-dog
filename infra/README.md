# AWS

```
aws sso login
aws configure export-credentials --format env-no-export > .env.aws
```

## `aws` dir
### `envs/local`

Before `terraform apply`, install Cognito Custom Email Sender Lambda deps on the host (the zip includes `node_modules`):

```
cd aws/resources/lambda/custom_email_sender
npm install --omit=dev
```

```
cd aws/envs/local
ln -sf ../../resources/* .
```

This env manages Cognito, SES, the custom email sender Lambda, one ECR repository for the API image (`walkdog-api`), and a GitHub Actions OIDC role that can push only to that repository. The OIDC trust is limited to `main` on `github_org`/`github_repo` (defaults `matsuokashuhei`/`walk-dog`). Publish uses short-lived OIDC credentials; this stack does not create long-lived AWS access keys for GitHub.

If the account already has `token.actions.githubusercontent.com` as an IAM OIDC provider, import it before the first apply:

```
terraform import aws_iam_openid_connect_provider.github_actions arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com
```

After apply, use outputs `ecr_repository_url` and `github_actions_ecr_role_arn` in the publish workflow.

```
cd infra
docker run --rm \
  -v "$(pwd)/aws:/workspace" \
  -w /workspace/envs/local \
  --env-file .env.aws \
  hashicorp/terraform:1.15 <command>
```

## `cloudflare` dir
### `env/local`

```
cd cloudflare/envs/local
ln -sf ../../resorces/* .
```

```
cd infra
docker run --rm \
  -v "$(pwd)/cloudflare:/workspace" \
  -w /workspace/envs/local \
  --env-file .env.aws \
  --env-file .env.cloudflare \
  hashicorp/terraform:1.15 <command>
```

## `terraform` dir

```
cd infra
docker run --rm \
  -v "$(pwd)/terraform:/workspace" \
  --env-file .env.aws \
  -w /workspace \
  hashicorp/terraform:1.15 <command>
```
