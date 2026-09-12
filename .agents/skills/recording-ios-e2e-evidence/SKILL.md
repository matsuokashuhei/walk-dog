---
name: recording-ios-e2e-evidence
description: iOS 自動 E2E の実行結果、成功状態、入力エラー状態、認証後状態のスクリーンショットを保存してセッション成果物へ添付するときに使用する。
---

# iOS E2E 証跡の記録

画面で観測できる状態と E2E 実行結果を対応付け、レビュー可能な成果物として残す。

## 物理実機 preflight

物理 iPhone で合格するセッションでは、シナリオ開始前に次を満たす。未充足なら implementer を出さず人間待ちにする。

1. 対象実機が listed（シミュレータのみは不合格）
2. 端末ロック解除（DDI / install が通る状態）
3. Apple PLA 承諾とアプリのプロビジョニングが通る
4. Cognito OTP が要るとき `aws sts get-caller-identity --profile <profile>` 成功（失敗なら `aws sso login`）
5. iOS 26+ で CoreDevice HID が使えないとき、iPhone Mirroring + Cursor Accessibility を先に有効化

## Cognito OTP

CloudWatch から OTP を取るときは `apps/mobile/scripts/e2e/fetch-cognito-otp.sh`（または同等の非 TTY 固定スクリプト）だけを使う。ホストの対話的 `aws` エイリアスや `docker … -ti` は使わない。スクリプト内の AWS 呼び出しは `type -P aws` の実バイナリ、または `docker run --rm`（`-t` / `-i` なし）。Verify へ進める前に SSO を確認する。

## 監視ループ

状況報告ループ（`AGENT_LOOP_TICK_*` など）は purpose ごとに常に 1 本。再武装する前に、同じ purpose の既存ループを列挙して全停止する。親が必須証跡を確認して合格した直後、委任サブエージェント完了を確認した直後、またはユーザーが停止を求めた直後に、その purpose の全 PID / ターミナルを kill し、完了通知を消費する。sandbox 越しなら親 PID だけでなく子プロセスも確認する。

## 手順

1. 仕様とテストシナリオから、成功、入力エラー、主要な回復または認証後状態を一覧にする。
2. 物理実機セッションなら上記 preflight を通す。OTP が要るなら上記 Cognito OTP 節に従う。
3. 各状態が画面に表示された直後、`docs/logs/<timestamp>-<slug>/screenshots/` に `ios-<flow>-<state>.png` 形式で保存する。
4. `e2e-report.md` に実行環境、実行コマンド、確認した画面状態、スクリーンショットを記載する。
5. 成功状態は遷移完了を示す画面で撮る。入力エラー状態は検証メッセージが見える画面で撮る。送信しない契約でも、client invalid を起こしてから撮る。未入力の Idle を入力エラーと名乗らない。認証後状態は認証済み画面で撮る。
6. レポートの相対パスと保存済み画像を確認し、テスト結果と画面証跡を同じセッション成果物に含める。
7. PR description への概要掲載は `publishing-pull-requests` に任せる。
8. 監視ループがあるときは上記「監視ループ」節に従う。

## 記録形式

| 状態 | 画面証跡 | レポートの確認内容 |
| --- | --- | --- |
| 成功 | 主要フローの完了画面 | 成功した操作と遷移先 |
| 入力エラー | 検証メッセージが読める画面。送信不可の Idle は使わない | 入力値、表示されたメッセージ、再試行操作 |
| 回復または認証後 | 回復操作または認証済み画面 | 遷移と利用可能な操作 |

## 検証

- 物理実機セッションでは preflight 項目がシナリオ開始前に満たされている。
- シナリオが CloudWatch OTP を使うとき、Verify 前に SSO が成功し、OTP は repo の非 TTY スクリプト経由である。
- 各必須状態に対応する PNG が `screenshots/` に存在する。
- 入力エラー PNG は検証メッセージが読める。メッセージが無い画面は入力エラー証跡にしない。
- `e2e-report.md` は各 PNG を Markdown で添付し、実行結果を記載する。
- E2E が返した結果と、画面で確認した状態を対応付ける。
- シミュレータまたは実機操作を別エージェントに委任した場合も、親が必須 PNG と `e2e-report.md` を契約どおり確認するまで合格にしない。委任先の完了宣言だけでは足りない。
- 監視ループがあるときは purpose ごとに 1 本で、合格・完了・停止のいずれかで全停止している。
