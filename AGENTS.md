
# 文書
- 仕様は、提供する機能、受け付ける入力、返すデータ、表示する状態、成立する遷移、集計対象を肯定形で定義する。
- スコープ外の機能、実装上の対比、存在しないデータや状態は説明しない。
- 外部から観測できる制約は、禁止や不在ではなく、一意性、許容値、前提条件、状態遷移、データソースとして記述する。
- エラー時は、画面またはAPIが返す状態、メッセージ、再試行操作を記述する。発生しない状態、保持しない実装詳細、内部保存先には触れない。

# コード
- Do not write overly defensive code. Always prefer simplicity over pathological complexity

# スキル
- `.agents/skills/` はCodex、Coarse、OpenAIが参照するスキル正本である。スキル本文とリソースはこの配下だけで更新する。
- `.agents/skill-library/` は分類済みの参照ビューである。正本を更新またはインストールした後は、`scripts/agent-skills.sh sync` を実行する。
- `scripts/agent-skills.sh check` は正本と分類リンクの整合性を検証する。

# 開発計画
- `docs/development/staged-development.md` は、walk / dog のリリース順序、承認済みの基盤判断、各リリースの提供機能、検証条件を定義する計画書である。
- 実装は計画書のR0からR3の順序で進め、各リリースの開始時に記載された判断を確定する。
