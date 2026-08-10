# Specification Review

## Status

`status: ready`

## Purpose and release

- Purpose: Hono、Drizzle、Zod のスキルを技術領域ごとの Codex プラグインとして提供する。
- Active release: R1。
- Classification: outside the staged plan. この変更はエージェントのスキル配布構成を対象とし、R1のプロダクト能力、公開 API、受け入れ条件を変更しない。

## Source map

| Source | Supporting section | Confirmed conclusion |
| --- | --- | --- |
| `docs/development/staged-development.md` | Goal、R0、R1 | R1の提供能力と公開インターフェースは維持される。 |
| `.agents/plugins/marketplace.json` | existing plugin entries | リポジトリはローカル marketplace からプラグインを提供する。 |
| `.agents/plugins/expo/.codex-plugin/plugin.json` | skills manifest | プラグインは `skills/` を配布単位として宣言する。 |
| `.agents/skills/` | Hono、Drizzle、Zod skill directories | 17スキルが移行対象である。 |

## Deliverables and verification

- `hono`、`drizzle`、`zod` の3プラグインが、それぞれのスキルを `skills/` 配下に提供する。
- marketplace が3プラグインのローカルソースを提供する。
- スキル間参照と `run-dev-session` の参照が名前空間付きスキル名を提供する。
- plugin manifest、skill frontmatter、JSON、参照検索が検証を通過する。

## Gaps checked

- R1の能力、R0基盤、公開 API、受け入れ条件を確認し、変更対象がいずれにも含まれないことを確認した。
- プラグイン先例と現在の17スキルを確認した。
- リリース開始時に確定する判断を変更しない。

## Decision classification

- Outside the staged plan: スキルのプラグイン配布構成。既存の marketplace 方式を使用する。
- Next permitted action: implementation.
