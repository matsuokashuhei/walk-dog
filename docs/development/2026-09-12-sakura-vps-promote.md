# さくら VPS でバックエンドを動かす

ECR の image digest（`repository@sha256:…`）で `api` と `worker` を同じ image で動かす。SSH で VPS に入り、リポジトリ根から作業する。Compose ファイルは `apps/compose.vps.yml` である。設計の説明は [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md) を見る。`deploy.sh` は sudo なしで実行する。

## 一度だけのホスト準備

次をそろえてから初回起動に進む。

1. Docker Engine と Compose plugin を入れる。実行ユーザーを `docker` グループに入れ、再ログインする。`docker info` が sudo なしで成功することを確認する。
2. リポジトリを実行ユーザーが書ける場所へ置く。

   ```bash
   git clone https://github.com/matsuokashuhei/walk-dog.git ~/walk-dog
   ```

3. `apps/.env.vps.example` を基に `~/walk-dog/apps/.env.vps` を作る。IAM ユーザー `walkdog-<env>-sakura-vps` のキー（Terraform output `sakura_vps_aws_access_key_id` / `sakura_vps_aws_secret_access_key`）、Cognito / SQS / DynamoDB、および載せたい `RELEASE_IMAGE`（`repository@sha256:…`）を入れる。実行ユーザー所有にし、そのアカウントだけが読める権限にする。`SQS_ENDPOINT` と `DYNAMODB_ENDPOINT` は設定しない。
4. ポート 3000 を、API を使う送信元だけに開ける。

## 反映に使う image

main の `publish` が ECR へ `${ECR_REPOSITORY_URL}:latest` と `${ECR_REPOSITORY_URL}:${{ github.sha }}` を push する。VPS 反映は digest ピンを使う。

```bash
# 例: publish 後に digest を取る
REPO='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api'
DIGEST=$(aws ecr describe-images --repository-name walkdog-dev-api --image-ids imageTag=latest \
  --query 'imageDetails[0].imageDigest' --output text --region ap-northeast-1)
export RELEASE_IMAGE="${REPO}@${DIGEST}"
```

`.env.vps` の `RELEASE` には同じ publish の commit SHA を入れる。`RELEASE_IMAGE` はシェルで渡すと `.env.vps` の値より優先する。

## 初回起動 / 新しい image の反映

```bash
export RELEASE_IMAGE='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api@sha256:…'
bash ~/walk-dog/infra/sakura/deploy.sh
```

`deploy.sh` は `git pull --ff-only`、ECR login、`api` / `worker` の pull、migrate、`api` / `worker` の recreate をこの順で行う。migrate が非ゼロならそこで止まる。

成功確認:

```bash
curl -fsS http://127.0.0.1:3000/health
```

## 再起動後に上げる

Compose は `RELEASE_IMAGE` が無いと image を解決できない。ホスト再起動のあと、`.env.vps` を読ませてから上げる。

```bash
set -a && . ~/walk-dog/apps/.env.vps && set +a
docker compose -f ~/walk-dog/apps/compose.vps.yml up -d api worker
curl -fsS http://127.0.0.1:3000/health
```

postgres のデータは volume `postgres-data` に残る。migrate は新しい image を載せるときだけ再実行する。

## health 失敗後の差し戻し

既知の成功 digest を `RELEASE_IMAGE` に指定して `deploy.sh` を再実行する。migration の自動 down は行わない。

## この手順の範囲外

- GitHub Actions から VPS への SSH deploy
- TLS 終端、reverse proxy、カスタム DNS
- migration の自動 down

## 関連

- [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md)
- [`infra/sakura/deploy.sh`](../../infra/sakura/deploy.sh)
- [`apps/compose.vps.yml`](../../apps/compose.vps.yml)
- [`apps/.env.vps.example`](../../apps/.env.vps.example)
