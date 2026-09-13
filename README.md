# walk / dog

ローカルでバックエンドと iOS アプリを起動する手順です。シミュレータと物理 iPhone の両方を扱う。

## 前提

- Docker Desktop が起動している
- Node.js と Xcode（iOS Simulator）が使える
- ローカル AWS スタックの Cognito 値が揃っている（[infra/README.md](infra/README.md)）

## バックエンド

`apps` で環境ファイルを用意し、Compose で API・worker・PostgreSQL・ElasticMQ・DynamoDB Local を起動します。

```bash
cd apps
cp .env.example .env.local
```

`.env.local` に `AWS_REGION`、`COGNITO_USER_POOL_ID`、`COGNITO_CLIENT_ID` を設定します。Compose 利用時は `POSTGRES_HOST=postgres` のままにします。ローカルエミュレータ向けに `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`（例: `local` / `local`）も設定します。

```bash
docker compose -f compose.yml up --build -d
curl --fail http://localhost:3000/health
```

`{"status":"ok"}` が返れば API は操作可能です。詳細と `503` 時の確認は [apps/api/README.md](apps/api/README.md) を参照してください。

停止:

```bash
cd apps
docker compose -f compose.yml down
```

## アプリ（iOS Simulator）

development build が必要です。Expo Go では位置情報・地図・Secure Store 向けのネイティブモジュールを使えません。

```bash
cd apps/mobile
cp .env.example .env
npm install
npx expo run:ios
```

`.env` の API 先は iOS Simulator から見たローカル Compose 向けに次を使います。

```
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
```

`EXPO_PUBLIC_*` を変えたあとはネイティブを再ビルドします。Metro のポートを固定する場合:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000 npx expo start --port 8082
```

詳細は [apps/mobile/README.md](apps/mobile/README.md) を参照してください。

## アプリ（物理 iPhone）

同一 LAN の Compose API に繋ぐ development client を実機へ入れる手順は次を使う。

[物理 iPhone に開発クライアントを入れる](docs/development/how-to-install-on-iphone.md)

## 関連ドキュメント

- [段階開発計画](docs/development/staged-development.md)
- [仕様書](docs/README.md)
- [インフラ](infra/README.md)
