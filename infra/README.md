# AWS

```
aws sso login
aws configure export-credentials --format env-no-export > .env.aws
```

## `aws` dir
### `envs/local`

```
cd aws/envs/local
ln -sf ../../resorces/* .
```

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
