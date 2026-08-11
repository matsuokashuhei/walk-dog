# API feature module と中核スキル Implementation Plan

**Goal:** feature-first API構成を実装判断の正本として定義し、その構成で機能を追加・変更する10個の責務別スキルを提供する。

**Architecture:** moduleがHTTP契約とuse case interfaceを所有し、infrastructureがCognito、Drizzle、observability、configの具象実装を提供する。composition rootが依存を接続する。スキルはこの依存方向に対応し、各責務を一つの日本語`SKILL.md`で案内する。

**Tech Stack:** Markdown、YAML frontmatter、Codex Skills、Hono、Zod、Drizzle、AWS SDK、Node.js test runner

## Global constraints

- `.agents/skills/`をスキル正本とする。
- 変更するbackend skillは日本語の`SKILL.md`を唯一の正本とする。
- 各skillは変更前baseline、変更後forward-test、quick validatorを完了する。
- `scripts/agent-skills.sh sync`と`check`で分類viewを同期・検証する。
- 公開HTTP契約と製品のrelease planを維持する。

## Tasks

### Task 1: architecture contract

- feature-first構成、責務、依存方向、route規則、test配置を設計書に定義する。
- 既存routing skill統合設計と未追跡planの判断を包括設計・計画へ吸収する。
- PR2の移行条件とPR3の技術skill整合条件を定義する。

### Task 2: organizing-api-feature-modules

- module、infrastructure、shared、composition rootの配置判断を案内するskillを新設する。
- 機能追加シナリオで配置と依存方向をbaseline/forward-testする。

### Task 3: routing-hono-apis

- `organizing-hono-route-modules`のendpoint命名、集約、共有責務を統合する。
- Hono routeとmodule/use case境界を日本語正本へ更新する。
- `organizing-hono-route-modules`と`routing-hono-apis/SKILL_ja.md`を削除する。

### Task 4: documenting-hono-openapi

- moduleの`contracts.ts`をOpenAPI契約の配置先として定義する。
- route、validation、response、error契約の更新順序を日本語正本へ更新する。

### Task 5: validating-hono-requests

- route境界で検証し、検証済み値をuse caseへ渡す責務を定義する。
- 共通validation errorと機能固有schemaの配置を日本語正本へ更新する。

### Task 6: implementing-api-use-cases

- HTTPと外部技術から独立したuse caseの入力、出力、依存interface、errorを案内するskillを新設する。
- Hono、AWS SDK、Drizzle、infrastructureへのimport境界を検証する。

### Task 7: implementing-drizzle-repositories

- module repository interfaceをDrizzleで実装するskillを新設する。
- rowとmodule typeの変換、constraint、transaction、query testの責務を定義する。

### Task 8: integrating-api-adapters

- Cognitoなどの外部providerをmodule interfaceへ変換するadapter skillを新設する。
- SDK errorとmodule errorの変換、設定注入、adapter testを定義する。

### Task 9: composing-api-dependencies

- composition rootでconfig、adapter、repository、use case、routeを接続するskillを新設する。
- concrete dependencyの生成順、lifecycle、module routeの一意なmountを定義する。

### Task 10: composing-hono-middleware

- middleware順序、context値、汎用error整形、横断的関心事の境界を日本語正本へ更新する。
- `layering-error-responsibilities`、`open-closed-validation`、`separating-cross-cutting-concerns`を統合して削除する。

### Task 11: testing-hono-apis

- module route、use case、infrastructure、compositionのtest責務を日本語正本へ更新する。
- 成功、入力不正、認証、競合、再試行可能error、OpenAPI、依存境界の検証を定義する。

## Final verification

- 10個のskillでbaseline、forward-test、quick validatorの記録が揃う。
- 吸収対象4 skillと変更対象の`SKILL_ja.md`が正本から除かれる。
- `scripts/agent-skills.sh sync`と`scripts/agent-skills.sh check`が成功する。
- `git diff --check`が成功する。
- session artifact reviewが全コメントの解決を確認する。
