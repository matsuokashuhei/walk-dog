# さくら VPS でバックエンドを動かす

ECR の `latest` タグで `api` と `worker` を同じ image で動かす。公開 HTTP は Caddy が `https://dev.walkdog.cacheandbuffer.com` で終端する。SSH で VPS に入り、リポジトリ根から作業する。Compose ファイルは `apps/compose.vps.yml` である。設計の説明は [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md) を見る。`deploy.sh` は sudo なしで実行する。

## 一度だけのホスト準備

次をそろえてから初回起動に進む。

1. Docker Engine と Compose plugin を入れる。実行ユーザーを `docker` グループに入れ、再ログインする。`docker info` が sudo なしで成功することを確認する。
2. リポジトリを実行ユーザーが書ける場所へ置く。

   ```bash
   git clone https://github.com/matsuokashuhei/walk-dog.git ~/walk-dog
   ```

3. `apps/.env.vps.example` を基に `~/walk-dog/apps/.env.vps` を作る。IAM ユーザー `walkdog-<env>-sakura-vps` のキー（Terraform output `sakura_vps_aws_access_key_id` / `sakura_vps_aws_secret_access_key`）、Cognito / SQS / DynamoDB を入れる。実行ユーザー所有にし、そのアカウントだけが読める権限にする。`SQS_ENDPOINT` と `DYNAMODB_ENDPOINT` は設定しない。
4. ホストの 80 / 443 を、API を使う送信元（または必要な範囲）に開ける。ホストの 3000 は公開しない。
5. `dev.walkdog.cacheandbuffer.com` の A レコードがこの VPS を指していること（DNS only。Cloudflare プロキシは使わない）。
6. メモリがおよそ 512Mi 以下のままなら、Caddy 追加後に OOM しやすい。不安定なら先に VPS を増強する。

## 反映に使う image

main の `publish` が ECR へ `${ECR_REPOSITORY_URL}:latest` と `${ECR_REPOSITORY_URL}:${{ github.sha }}` を push する。`deploy.sh` は常に `walkdog-dev-api:latest` を pull する。

`.env.vps` の `RELEASE` には、載せたい publish の commit SHA を入れる。

## 初回起動 / 新しい latest の反映

```bash
bash ~/walk-dog/infra/sakura/deploy.sh
```

`deploy.sh` は `git pull --ff-only`、ECR login、`latest` の pull、migrate、`caddy` / `api` / `worker` の recreate をこの順で行う。migrate が非ゼロならそこで止まる。

成功確認:

```bash
curl -fsS https://dev.walkdog.cacheandbuffer.com/health
```

## 再起動後に上げる

Compose は `RELEASE_IMAGE` がシェルに無いと image を解決できない。ホスト再起動のあと、次で上げる。

```bash
export RELEASE_IMAGE='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api:latest'
docker compose -f ~/walk-dog/apps/compose.vps.yml up -d caddy api worker
curl -fsS https://dev.walkdog.cacheandbuffer.com/health
```

postgres のデータは volume `postgres-data` に残る。Caddy の証明書は volume `caddy-data` に残る。migrate は新しい image を載せるときだけ再実行する。

## health 失敗後の差し戻し

既知の成功 publish の commit SHA tag を `RELEASE_IMAGE` に指定して pull し、`caddy` / `api` / `worker` を上げ直す。migration の自動 down は行わない。

```bash
export RELEASE_IMAGE='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api:<known-good-commit-sha>'
docker pull "${RELEASE_IMAGE}"
docker compose -f ~/walk-dog/apps/compose.vps.yml up -d --force-recreate caddy api worker
```

## この手順の範囲外

- GitHub Actions から VPS への SSH deploy
- Cloudflare オレンジ雲への切り替え
- migration の自動 down

## 関連

- [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md)
- [`infra/sakura/deploy.sh`](../../infra/sakura/deploy.sh)
- [`infra/sakura/Caddyfile`](../../infra/sakura/Caddyfile)
- [`apps/compose.vps.yml`](../../apps/compose.vps.yml)
- [`apps/.env.vps.example`](../../apps/.env.vps.example)
