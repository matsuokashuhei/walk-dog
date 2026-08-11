# 仕様確認

- status: `ready`
- active release: R1（散歩記録の縦切り）
- purpose: `apps/api` の feature-first アーキテクチャ契約と、その構成で開発するための中核スキルを整備する。
- next permitted action: `implementation`

## 現在リリースの提供能力

- R1のアカウント縦切りは、Sign Up、Sign In、OTP確認、Owner表示名登録、Sign Outを提供する。
- APIはHonoと`@hono/zod-openapi`を使い、OpenAPI schemaを入力検証、レスポンス、モバイル型付きclient生成のデータソースとして扱う。
- 認証済みAPIはCognito access tokenのsubjectからOwnerを一意に解決する。
- APIエラーはHTTP status、`code`、`message`、`requestId`、`retryable`で状態を表す。
- PostgreSQLはDrizzle clientとschemaを使い、Ownerの永続化を提供する。

## Source map

| Source | Supporting section | Conclusion |
| --- | --- | --- |
| `docs/development/staged-development.md` | 承認済みの判断、進捗状況、R1、公開インターフェース、検証 | Hono、OpenAPI、R1アカウント機能、契約テストが現在の基盤と検証条件である。 |
| `docs/specs/2026-07-26-hono-api-r0-design.md` | 構成、HTTP API、PostgreSQL、観測性、コード品質 | 外部HTTP契約、Owner境界、DB、横断処理の責務を維持する。 |
| `docs/logs/20260726141518-decide-and-execute-development/transcript.md` | Hono構成、Drizzle ORM、Cognito認証とOwner境界、共通middleware | Hono route中心のHTTP境界とDrizzle/Cognitoの技術判断を維持する。 |
| `docs/specs/2026-08-11-routing-hono-apis-skill-integration-design.md` | 成果物、命名と責務、検証条件 | 既存のrouting skill統合を包括的なfeature-first skill再編へ吸収する。 |
| `apps/api/src` と `apps/api/test` | 現在の実装 | 現在の公開route、認証、Owner永続化、観測性と45件のテストがPR2の挙動維持基準になる。 |

## Decision classifications

### Implementation-local

- `src/modules`を第一分類とし、`auth`、`owners`、`health`を機能単位に配置する。
- 外部技術の具象実装を`src/infrastructure`へ配置する。
- API Zod契約をmoduleの`contracts.ts`、Drizzle schemaをdatabase infrastructureへ配置する。
- route、use case、repository interface、adapter、composition rootの依存方向をスキルで定義する。
- `src/shared`は共通HTTP error契約から開始する。

### Outside the staged plan

- `.agents/skills`の責務別再編と日本語正本化は、エージェント開発手順の改善であり、製品の提供能力とリリース順序を変更しない。

### Plan-level

- 追加のplan-level decisionはない。公開HTTP契約、提供機能、検証条件を維持する。

### Deferred release decisions

- TrackPoint再試行上限はR1 TrackPoint開始時に確定する。
- Walk・Owner削除、データ保持期間、法務文書URLはR3開始時に確定する。

## Verification conditions

- 各中核スキルは変更前baseline、変更後forward-test、skill validatorを完了する。
- `scripts/agent-skills.sh sync`後、分類リンクが正本を参照する。
- `scripts/agent-skills.sh check`と`git diff --check`が成功する。
- PR1は文書とスキルのみを変更し、APIの公開HTTP契約と実装を維持する。

## Gaps checked

- R1とR2/R3の境界を確認し、今回の変更がR1の機能追加や順序変更を含まないことを確認した。
- Hono R0仕様の認証、エラー、OpenAPI、Owner、PostgreSQL、観測性の前提を確認した。
- 導入済み基盤を`apps/api/src`、`apps/api/test`、Drizzle設定とpackage scriptsで照合した。
- staged planの前提表を変更しないため、表セルの更新は発生しない。
- 既存routing設計と未追跡planは、ユーザー承認済みの包括設計・計画に吸収される。
