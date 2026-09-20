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
6. ホスト RAM がおよそ 512Mi で swap が無い構成を前提にする。`deploy.sh` は pull / extract の前に `caddy` / `api` / `worker` を止め、image を順次 pull する。

## 反映に使う image

main の `publish` が ECR へ `${ECR_REPOSITORY_URL}:latest` と `${ECR_REPOSITORY_URL}:${{ github.sha }}` を push する。`deploy.sh` は常に `walkdog-dev-api:latest`（api / worker）と `:migrate` を pull する。

`.env.vps` の `RELEASE` には、載せたい publish の commit SHA を入れる。

## 初回起動 / 新しい latest の反映

```bash
bash ~/walk-dog/infra/sakura/deploy.sh
```

`deploy.sh` は次の順で動く。migrate が非ゼロならそこで止まる。

1. `git pull --ff-only`
2. ECR login
3. `caddy` / `api` / `worker` を stop（postgres は動かしたまま）
4. `migrate` を pull → `api`（= worker と同じ image）を pull（並列 extract しない）
5. migrate 実行
6. `caddy` / `api` / `worker` を recreate
7. dangling image だけ prune（`:migrate` タグは残す）

成功確認:

```bash
curl -fsS https://dev.walkdog.cacheandbuffer.com/health
```

## 反映中にホストが固まったとき（増強しない）

症状は、SSH が応答しない、CPU / disk write が急増する、のあと reboot して戻る、である。原因は image の並列 pull / layer extract が RAM を食い、swap 無しホストを thrash させることにある。ディスク満杯が主因ではない（通常 `df -h /` は余裕がある）。

復旧:

1. SSH が戻るまで待つ。戻らなければさくらのコントロールパネルから **再起動**する（プラン変更・スペック増強ではない）。
2. 再起動後:

```bash
export RELEASE_IMAGE='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api:latest'
export MIGRATE_IMAGE='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-dev-api:migrate'
docker compose -f ~/walk-dog/apps/compose.vps.yml up -d caddy api worker
curl -fsS https://dev.walkdog.cacheandbuffer.com/health
```

3. 新しい `latest` を載せ直すときは、上記の `deploy.sh`（stop → 順次 pull → migrate → recreate）を使う。手動で `docker compose pull` を並列実行しない。
4. 古い未使用 image を消すときは `docker image prune -f`（dangling のみ）。`docker image prune -af` は次の migrate 用 `:migrate` まで消すので使わない。

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
