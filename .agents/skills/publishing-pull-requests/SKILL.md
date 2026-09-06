---
name: publishing-pull-requests
description: セッションの Pull Request を作成・更新・説明文編集・マージするとき、または iOS E2E のスクリーンショットを PR 本文へ載せるときに使用する。
---

# Pull Request の公開

セッション成果を forge の Pull Request として公開・更新・マージする。ブランチ統合のメニュー自体は `finishing-a-development-branch` に残す。

## 作成と更新

- 同じブランチに未マージの PR があるときは、その PR を更新する。「新規作成」と言わない。
- 未マージの PR が無いときだけ作成する。
- URL を相手に返す。

## 説明文

概要（Summary）と検証計画（Test plan）を書く。リポジトリの PR テンプレートがあれば従う。

セッションに iOS E2E 証跡（`e2e-report.md` と必須の `screenshots/*.png`）があるときは、説明文に次を含める。

- 必須状態ごとの結果を一文で書く
- 対応する PNG を Markdown 画像として埋め込む（リポジトリ上の URL。例: `raw.githubusercontent.com/.../docs/logs/<timestamp>-<slug>/screenshots/ios-....png`）
- 詳細は `e2e-report.md` へリンクする

証跡が PR 作成より後に揃ったとき、またはマージ後に掲載を求められたときも、同じ PR の説明文を編集する。

画面証跡の撮影と `e2e-report.md` の書き方は `recording-ios-e2e-evidence` に従う。

## マージ

相手がマージを依頼したときだけ実行する。

1. 必須の CI が成功していることを確認する
2. 失敗しているチェックがあれば直して push し、成功するまでマージしない
3. 成功を確認してから forge のマージを実行する

マージ確認後は `run-dev-session` のマージ後フェーズ（振り返り）へ進む。

## 検証

- 未マージ PR があるブランチで「新規作成」と説明していない
- E2E 証跡があるセッションでは、説明文に必須状態の概要と埋め込み画像がある
- マージ前に必須の CI が成功している
