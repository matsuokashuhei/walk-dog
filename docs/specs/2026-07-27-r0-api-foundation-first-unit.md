# R0 API基盤 最初の作業単位

## 目的

R0は、モバイルクライアントと後続のAPI機能が利用するNode.js APIの実行基盤、OpenAPI契約、相関ID付きの応答状態を提供する。

## 公開インターフェース

### `GET /health`

APIプロセスはHTTP 200と次のJSONを返す。

```json
{
  "status": "ok"
}
```

### `GET /openapi.json`

APIはOpenAPI 3.1 JSONを返す。この文書は`/health`、失敗応答、`X-Request-Id`応答ヘッダーを定義する。

### 失敗応答

APIは、未知のパスにHTTP 404、処理失敗にHTTP 500を返す。各応答は次のJSONを返す。

```json
{
  "code": "string",
  "message": "string",
  "requestId": "string",
  "retryable": false
}
```

## リクエストID

APIは受信した`X-Request-Id`を応答ヘッダーとJSONの`requestId`へ返す。ヘッダーを持たないリクエストにはAPIが生成したIDを使用する。

## 実行と検証

`apps/api`はHonoと`@hono/node-server`でHTTP APIを提供する。`npm run dev`は開発サーバーを起動し、`npm run build`はTypeScript出力を生成し、`npm start`は生成済み出力を起動する。

自動テストはhealth、OpenAPI文書、404失敗応答、request IDを確認する。実行中の開発サーバーは`/health`と`/openapi.json`へのHTTPリクエストを処理する。
