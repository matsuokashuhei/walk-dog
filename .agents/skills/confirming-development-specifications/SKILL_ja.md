---
name: confirming-development-specifications
description: Use when a development session must confirm purpose against product contracts and the release plan before design or implementation.
---

# 開発仕様の確認

設計の前に、目的を製品契約とリリース計画へ照合し、根拠付きのレビューを残す。ソースから契約を推測しない。

## ソース

AGENTS.md が示す計画書、仕様、セッションログをこの順で読み、現行実装と照合する。各結論にソース参照を付ける。必須ソースは AGENTS.md が示す計画書と仕様である。

## ワークフロー

1. 目的と現行リリースを述べる。
2. 目的に必要な振る舞いだけを肯定形で取り出す。
3. 取り出した項目をソース参照へ対応付ける。
4. 判断を分類する: 計画レベル / 実装ローカル / 後続 / 計画外。計画レベルはユーザー確認のあと、実装前に計画書へ同期する。
5. レビュー記録をセッションディレクトリに書き、トランスクリプトの成果物リストへ載せる。
6. 確認を求める前に、目的が含む契約を承認できる形で提示する。画面なら画面契約、HTTP API ならリクエスト・レスポンス・振る舞い。どちらも含まないときは省略する。

## 契約提示

HTTP API を含むとき、method ごとの HTML をセッションディレクトリへ置く。各 method 節は Endpoint、Request parameters、Response、Example を持つ。

各 method の成功 Response Body は、その method の節に全部書く。GET に書いた同じ形を会話で示すだけでは、POST の提示にならない。POST が作成と同時に返す入れ子フィールドは POST 成功節に書く。

## 状態

- `ready`: 必須ソースが存在し、成果物にソース参照があり、関連ソースが一致し、計画レベルの判断が確認済みで、必要な契約提示が済んでいる。`ready` のとき設計へ進む。
- `awaiting-confirmation`: ユーザー承認が必要。設計しない
- `blocked`: 必須ソースの欠落または衝突。欠落を記録し、推測で埋めない
