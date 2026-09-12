# Sakura VPS で API を動かす

同じ ECR image digest で `api` と `worker` を動かし、`GET /health` が成功する状態にする。作業は VPS 上で SSH 経由で行う。リポジトリ根から実行する。Compose ファイルは `apps/compose.vps.yml` である。

## 一度だけのホスト準備

次をそろえてから初回起動に進む。

1. Docker Engine と Compose plugin を入れる。
2. このリポジトリを VPS 上に置く（clone または同等の同期）。
3. ECR から pull できる AWS 認証を入れる。GitHub Actions の publish 用 OIDC role とは別 identity を使う。
4. `apps/.env.vps.example` を基に `apps/.env.vps` を作る。root 所有にし、Compose を実行するアカウントだけが読める権限にする。`SQS_ENDPOINT` と `DYNAMODB_ENDPOINT` は設定しない。
5. digest 状態ファイルをリポジトリ外に置く。ひな型は `apps/vps/digest-state.example` である。例の置き場は `/var/lib/walkdog/digest-state` である。初回は example をそのパスへコピーしてから使う。
6. ポート 3000 を、API を使う送信元だけに開ける。

## digest を取る

反映の正本は image digest（`sha256:…`）である。main の `publish` workflow が成果物 `release-manifest` を出す。

1. GitHub の Actions で最新の成功した `publish` run を開く。
2. Artifacts から `release-manifest` をダウンロードする。
3. 中の digest と commit SHA を控える。`RELEASE` にはその commit SHA を入れる。

CLI を使う場合の例である。

```bash
gh run list --workflow=publish.yml --branch main --limit 5
gh run download <run-id> -n release-manifest -D /tmp/release-manifest
```

## 初回起動

控えた digest を `NEW_DIGEST` に入れる。

1. digest を pull する。

   ```bash
   export RELEASE_REPOSITORY='967026628831.dkr.ecr.ap-northeast-1.amazonaws.com/walkdog-api'
   export NEW_DIGEST='sha256:…'
   export RELEASE_IMAGE="${RELEASE_REPOSITORY}@${NEW_DIGEST}"
   aws ecr get-login-password --region ap-northeast-1 \
     | docker login --username AWS --password-stdin "${RELEASE_REPOSITORY%%/*}"
   docker pull "${RELEASE_IMAGE}"
   ```

2. 同じ digest で migrate を one-shot 実行する。

   ```bash
   docker compose -f apps/compose.vps.yml run --rm migrate
   ```

   成功は exit 0 と、適用した migration version の構造化ログである。非ゼロならここで止める。`api` と `worker` はまだ上げない。修正入りの image を publish し、新しい digest で手順 1 からやり直す。

3. `api` をその digest で起動する。

   ```bash
   docker compose -f apps/compose.vps.yml up -d api
   ```

4. `worker` を同じ digest で起動する。

   ```bash
   docker compose -f apps/compose.vps.yml up -d worker
   ```

5. health が成功するまで確認する。

   ```bash
   curl -fsS http://127.0.0.1:3000/health
   ```

   成功は PostgreSQL と worker health の両方が通り、成功 JSON が返ることである。

6. health 成功後だけ digest 状態を書く。`STATE` を実際のパスにする。

   ```bash
   STATE=/var/lib/walkdog/digest-state
   set -a
   # shellcheck source=/dev/null
   . "$STATE"
   set +a
   PREVIOUS_DIGEST="$CURRENT_DIGEST"
   CURRENT_DIGEST="$NEW_DIGEST"
   printf 'CURRENT_DIGEST=%s\nPREVIOUS_DIGEST=%s\nRELEASE_REPOSITORY=%s\n' \
     "$CURRENT_DIGEST" "$PREVIOUS_DIGEST" "$RELEASE_REPOSITORY" > "$STATE"
   ```

初回は `PREVIOUS_DIGEST` が example のゼロ値のままでよい。差し戻しが必要になるのは、一度成功したあとである。

## 再起動後に同じ digest で上げる

Compose は digest 状態ファイルを読まない。`RELEASE_IMAGE` がシェルに無いと `api` / `worker` / `migrate` の image を解決できない。ホスト再起動のあと、または promote なしで container を上げ直すとき、先に状態から環境を載せる。

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

postgres のデータは volume `postgres-data` に残る。migrate は新しい digest を載せるときだけ再実行する。

## 新しい digest を反映する

稼働中の VPS に別の digest を載せるときも、上の手順 1 から 6 を同じ順で実行する。

migrate が失敗したら稼働中の `api` と `worker` はそのままにする。新しい digest で 1 からやり直す。

## health 失敗後の差し戻し

手順 3 または 4 のあとで手順 5 が成功しないとき、次を行う。

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

3. その digest で `api` を起動し、続けて `worker` を起動する。

   ```bash
   docker compose -f apps/compose.vps.yml up -d api
   docker compose -f apps/compose.vps.yml up -d worker
   ```

4. `GET /health` が成功することを確認する。

migration の自動 down は行わない。差し戻しは image の差し戻しだけである。

## この手順の範囲外

- GitHub Actions から VPS への SSH deploy
- TLS 終端、reverse proxy、カスタム DNS

## 関連

- [さくら VPS API 提供経路 設計](../specs/2026-09-12-sakura-vps-api-delivery-design.md)
- [`apps/compose.vps.yml`](../../apps/compose.vps.yml)
- [`apps/.env.vps.example`](../../apps/.env.vps.example)
