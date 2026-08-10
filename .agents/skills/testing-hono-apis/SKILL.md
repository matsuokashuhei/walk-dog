---
name: testing-hono-apis
description: Hono API の HTTP 契約テストを追加、修正、分割するときに使用する。endpoint ごとのテスト、app.request、Node.js の node:test、外部依存のテストダブルが関わる場合に適用する。
---

# Hono API のテスト

HTTP 契約を application factory に対して検証し、テストの構成を endpoint と対応させる。

## 必読資料

テストを変更する前に、公式 Hono Testing Guide と Testing Helper、Node.js Test Runner（<https://nodejs.org/api/test.html>）を読む。セッション記録または PR に資料と選択した方式を残す。

## 基本方針

1. Node.js listener は起動せず、application factory が返す app に `app.request()` を渡す。
2. 1 endpoint のテストファイルは、対応する route 登録関数を直接登録する。`POST /v1/auth/sign-in` は `sign-in.test.ts` のように URL と対応させる。
3. 各 endpoint は成功、入力不正、仕様上の主要な外部サービスエラーについて、status と公開レスポンスを検証する。JSON 入力には `Content-Type: application/json` を付ける。
4. DB、Cognito、時刻、トークンなどの境界はテストダブルにし、fixture に集約する。個別テストは request と API 応答だけを記述する。
5. 複数 endpoint を登録する集約関数は、別の `*-routes.test.ts` で OpenAPI または登録済み endpoint を検証する。

## 選択

| 状況 | 方式 |
| --- | --- |
| endpoint の応答契約 | 対応する `register…Route` と `app.request()` |
| endpoint 集約の登録 | `register…Routes` と OpenAPI 文書 |
| 外部サービスの結果 | fixture の Cognito・DB テストダブル |
| chain 定義済み Hono app | `testClient()` を検討する |
| 後から route を登録する app | `app.request()` を使う |

`node:test` の `test`、`describe`、`it` で意図を階層化し、各テストは1つの公開振る舞いを名前にする。

## 検証

- 対象 endpoint の成功と各主要エラーの status、`code`、`message`、`requestId`、`retryable` を必要に応じて確認する。
- 型検査、lint、対象テスト、全テストを実行する。
- fixture とテストに lint 抑制コメントを追加せず、型で境界を表現する。
