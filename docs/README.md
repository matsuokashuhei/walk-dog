# docs

このディレクトリは、walk / dog の仕様書、プロジェクト管理、AIセッションログを管理する。

## 構成

```text
docs/
├── specifications/
├── project-management/
└── ai-sessions/
```

### 仕様書

`specifications/` は、プロダクトが提供する画面、API、データ、用語、利用者の操作を定義する。

- [ドメインモデル](specifications/domain-model.md)
- [外部仕様書](specifications/external-specification.html)
- [モバイルジャーニーとワイヤーフロー](specifications/mobile-journey-wireflow.html)

### プロジェクト管理

`project-management/` は、開発のリリース順序、計画、判断を管理する。

- [段階開発計画](project-management/plans/2026-07-25-walk-dog-staged-development.md)

### AIセッションログ

`ai-sessions/` は、AIとの作業セッションを要約したMarkdownを保存する。ファイル名は `YYYY-MM-DD-<topic>.md` とし、各ログには目的、決定、変更、次の作業を記録する。
