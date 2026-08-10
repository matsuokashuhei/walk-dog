---
name: organizing-hono-route-modules
description: Hono の route ファイル、route 定数、登録関数の命名または責務が URL endpoint と一致しないときに使用する。endpoint 単位の構成と共有ロジックの配置を統一する。
---

# Hono ルートモジュールの整理

Hono API の公開 HTTP 契約を保ちながら、ルートの名前、責務、依存関係を endpoint 単位で明確にする。

## 手順

1. 対象の `routes/`、集約モジュール、`app.route` または `app.openapi` の登録箇所を読み、各 HTTP method と path を一覧にする。
2. 各 endpoint に対応する route 定数、登録関数、モジュールを対応付ける。`/v1/auth/sign-in/verify` は `sign-in-verify.ts`、`signInVerifyRoute`、`registerSignInVerifyRoute` のように URL の語順を保つ。
3. 1 モジュールには 1 endpoint の HTTP 契約とハンドラを置く。複数 endpoint を登録しているモジュールは URL ごとに分ける。
4. 集約モジュールは `registerAuthRoutes` のように複数 endpoint の登録だけを行う。個別 endpoint の登録関数は単数形の `register…Route` とする。
5. owner 解決、トークン解析、永続化、共通 schema のように HTTP endpoint 間で共有する責務は、`auth/` などの機能層へ置く。
6. path、HTTP method、入力 schema、レスポンス、ステータス、OpenAPI 定義を保ったまま import を更新する。

## 判定基準

| 対象 | 配置と名前 |
| --- | --- |
| 個別 endpoint | URL に対応するファイル、`…Route`、`register…Route` |
| 複数 endpoint の登録 | `routes/<機能>.ts` の `register…Routes` |
| 共有する認証・DB 処理 | 機能層のモジュール |
| 共通の OpenAPI schema | 機能層の契約モジュール |

ファイル行数や関数行数の制約は、endpoint または共有責務の分割で満たす。lint 無効化コメントは追加しない。

## 検証

- 対象 endpoint の API テストで成功・エラーの応答を確認する。
- OpenAPI 文書に同じ path と method が含まれることを確認する。
- 型検査と lint を実行し、抑制コメントなしで通過させる。
- 変更後の import と登録順序から、各 endpoint が一度だけ登録されることを確認する。
