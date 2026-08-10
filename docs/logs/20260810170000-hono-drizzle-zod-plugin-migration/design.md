# Design

## WHAT

Hono、Drizzle、Zod のスキルを、各技術領域を表すプラグインとして発見・導入できる状態にする。各スキルの技術ガイダンスと日本語版を維持し、スキル参照は `hono:`、`drizzle:`、`zod:` の名前空間を使用する。

## HOW

`.agents/plugins/<plugin>/skills/<skill>/` へ対象ディレクトリを移動し、各プラグインに `.codex-plugin/plugin.json` を追加する。marketplace は3エントリを追加し、個別の `agents/openai.yaml` は既存の Expo/EAS プラグインと同じく提供しない。移動したドキュメントと `run-dev-session` の `$skill` 参照を名前空間付きへ更新する。

## WHY

技術領域ごとのプラグインは、関連スキルを一つの導入単位で提供し、既存の Expo/EAS の配布構成と揃う。プロダクトのリリース能力と API 契約は維持される。
