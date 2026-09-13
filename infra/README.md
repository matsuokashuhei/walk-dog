# AWS

```
aws sso login
aws configure export-credentials --format env-no-export > .env.aws
```

## `terraform.sh`

Interactive wrapper for Docker Terraform (`hashicorp/terraform:1.15`).

```
cd infra
./terraform.sh
```

Prompts, in order:

1. provider: `aws` / `cloudflare`
2. env: `local` / `dev` / `prod`
3. command: `init` / `plan` / `apply`
4. mode: `run` / `dry-run` (`dry-run` prints the docker command only)

Mounts `./<provider>` at `/workspace` and runs with `-w /workspace/envs/<env>`. Always loads `.env.aws`. Cloudflare also loads `.env.cloudflare`.

Override image with `TERRAFORM_IMAGE=...` if needed.

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

If the account already has `token.actions.githubusercontent.com` as an IAM OIDC provider, import it before the first apply:

```
terraform import aws_iam_openid_connect_provider.github_actions arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com
```

After apply, use outputs `ecr_repository_url` and `github_actions_ecr_role_arn` in the publish workflow.

Manual equivalent:

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

Manual equivalent:

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
