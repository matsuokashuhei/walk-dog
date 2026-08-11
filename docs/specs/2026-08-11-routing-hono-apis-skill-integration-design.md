# routing-hono-apis スキル統合設計

## 目的

`routing-hono-apis` を、Hono endpoint の HTTP 契約、ハンドラー、route module 構成、登録、検証を一貫して扱う日本語スキルとして提供する。

## 成果物

- `.agents/skills/routing-hono-apis/SKILL.md` を日本語の正本として更新する。
- `organizing-hono-route-modules` の endpoint 単位の命名、配置、集約、共有責務を `routing-hono-apis` へ統合する。
- `routing-hono-apis/SKILL_ja.md` の内容を正本へ反映し、正本を一つにする。
- `.agents/skill-library/` を正本の構成と同期する。

## スキルの構成

統合後の `SKILL.md` は次の順序で判断と作業を導く。

1. 公式 Hono 資料を確認し、変更対象の method、path、status、入出力を定義する。
2. URL endpoint と route ファイル、route 定数、登録関数を対応付ける。
3. 個別 endpoint、複数 endpoint の集約、機能層の共有処理、共通契約を配置する。
4. `/v1` 配下への route 登録と公開 HTTP 契約を実装する。
5. OpenAPI、入力 validation、API 契約テストを関連スキルで整合させる。
6. 型検査、lint、対象テスト、OpenAPI、endpoint の一意な登録を検証する。

## 命名と責務

- endpoint module は URL の語順に対応するファイル名を持つ。
- route 定数は `…Route`、個別登録関数は `register…Route`、集約登録関数は `register…Routes` を使用する。
- 個別 module は一つの method と path に対応する HTTP 契約と handler を持つ。
- 集約 module は複数 endpoint の登録を担う。
- 認証主体の解決、トークン解析、永続化、共通 schema は機能層で共有する。

## 検証条件

- 統合後の `SKILL.md` が有効な frontmatter と日本語本文を持つ。
- 新しい route の成功、OpenAPI に定義された各エラー status、入力不正を `testing-hono-apis` で検証する。
- OpenAPI 文書が対象の method と path を含む。
- 各 endpoint が一度登録される。
- 型検査、lint、対象テスト、スキル validator、`scripts/agent-skills.sh check` が成功する。
