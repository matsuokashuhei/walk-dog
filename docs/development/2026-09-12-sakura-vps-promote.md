# さくら VPS でバックエンドを動かす

ECR の `latest` タグで `api` と `worker` を同じ image で動かす。`GET /health` が成功する状態にする。SSH で VPS に入り、リポジトリ根から作業する。Compose ファイルは `apps/compose.vps.yml` である。設計の説明は [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md) を見る。

## 一度だけのホスト準備

次をそろえてから初回起動に進む。

1. Docker Engine と Compose plugin を入れる。
2. IAM ユーザー `walkdog-sakura-vps` のアクセスキーをホストの AWS CLI に入れる。GitHub Actions の publish 用 OIDC role は使わない。キーは Terraform output `sakura_vps_aws_access_key_id` / `sakura_vps_aws_secret_access_key` から取る。
3. リポジトリを `WALKDOG_ROOT`（既定 `/opt/walk-dog`）へ置く。

   ```bash
   sudo git clone https://github.com/matsuokashuhei/walk-dog.git /opt/walk-dog
   ```

4. `apps/.env.vps.example` を基に `WALKDOG_ROOT/apps/.env.vps` を作る。`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` に同じ IAM キーを入れる。root 所有にする。Compose を実行するアカウントだけが読める権限にする。`SQS_ENDPOINT` と `DYNAMODB_ENDPOINT` は設定しない。`deploy.sh` は `.env.vps` を作らない。無いと止まる。
5. ポート 3000 を、API を使う送信元だけに開ける。

差し戻し用の状態ファイルは `DIGEST_STATE`（既定 `/var/lib/walkdog/digest-state`）である。無いときは `deploy.sh` が `apps/vps/digest-state.example` から作る。

## 反映に使う image

反映の参照は `latest` タグである。main の `publish` が ECR へ `${ECR_REPOSITORY_URL}:latest` と `${ECR_REPOSITORY_URL}:${{ github.sha }}` を push する。

`.env.vps` の `RELEASE` には、載せたい publish の commit SHA を入れる。Actions の成功した `publish` run の commit か、artifact `release-manifest` の `commitSha` を使う。

`deploy.sh` は次を既定にする。環境変数で上書きできる。

```bash
export RELEASE_REPOSITORY='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-api'
export RELEASE_IMAGE="${RELEASE_REPOSITORY}:latest"
```

## 初回起動

ホスト準備のあと、次を実行する。

```bash
sudo bash /opt/walk-dog/apps/vps/deploy.sh
```

成功は exit 0 と、`GET /health` が成功 JSON を返すことである。migrate が非ゼロなら `api` と `worker` は上がらない。修正入りの image を publish し、同じコマンドを再実行する。

`WALKDOG_ROOT` を既定以外にするときは、その根の `apps/vps/deploy.sh` を同じように実行する。

## 再起動後に上げる

Compose は状態ファイルを読まない。`RELEASE_IMAGE` がシェルに無いと `api` / `worker` / `migrate` の image を解決できない。ホスト再起動のあと、または promote なしで container を上げ直すとき、先に環境を載せる。

いま動いている版をそのまま上げるなら digest ピンを使う。

```bash
STATE=/var/lib/walkdog/digest-state
set -a
# shellcheck source=/dev/null
. "$STATE"
set +a
export RELEASE_IMAGE="${RELEASE_REPOSITORY}@${CURRENT_DIGEST}"
docker compose -f apps/compose.vps.yml up -d api worker
curl -fsS http://127.0.0.1:3000/health
```

ECR 上の新しい `latest` を取りに行くなら、次節の手順を使う。

postgres のデータは volume `postgres-data` に残る。migrate は新しい image を載せるときだけ再実行する。

## 新しい latest を反映する

main の `publish` が新しい `latest` を push したあと、次を実行する。

```bash
sudo bash /opt/walk-dog/apps/vps/deploy.sh
```

migrate が失敗したら稼働中の `api` と `worker` はそのままにする。修正後の `latest` で同じコマンドを再実行する。

## health 失敗後の差し戻し

`deploy.sh` が health に失敗したとき、または手動で `api` / `worker` を上げたあと health が成功しないとき、次を行う。`latest` は使わない。状態ファイルの直前成功 digest に戻す。

1. 新しい container を止める。
2. digest 状態の `PREVIOUS_DIGEST` で `RELEASE_IMAGE` を組み立てる。

   ```bash
   STATE=/var/lib/walkdog/digest-state
   set -a
   # shellcheck source=/dev/null
   . "$STATE"
   set +a
   export RELEASE_IMAGE="${RELEASE_REPOSITORY}@${PREVIOUS_DIGEST}"
   ```

3. その digest で `api` を起動する。続けて `worker` を起動する。

   ```bash
   docker compose -f apps/compose.vps.yml up -d api
   docker compose -f apps/compose.vps.yml up -d worker
   ```

4. `GET /health` が成功することを確認する。

migration の自動 down は行わない。差し戻しは image の差し戻しだけである。

## この手順の範囲外

- GitHub Actions から VPS への SSH deploy
- TLS 終端、reverse proxy、カスタム DNS
- migration の自動 down

## 関連

- [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md)
- [`apps/vps/deploy.sh`](../../apps/vps/deploy.sh)
- [`apps/compose.vps.yml`](../../apps/compose.vps.yml)
- [`apps/.env.vps.example`](../../apps/.env.vps.example)
- [`apps/vps/digest-state.example`](../../apps/vps/digest-state.example)
