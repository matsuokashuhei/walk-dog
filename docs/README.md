# docs

このディレクトリは、walk / dog の仕様書、開発の記録、AI開発ログを管理する。

## 構成

```text
docs/
├── specs/
├── development/
└── logs/
```

### 仕様書

`specs/` は、プロダクトが提供する画面、API、データ、用語、利用者の操作を定義する。

- [外部仕様書](specs/external-specification.html)
- [モバイルジャーニーとワイヤーフロー](specs/mobile-journey-wireflow.html)

### プロジェクト管理

`development/` は、開発の進め方、進捗、判断を管理する。

- [段階開発計画](development/staged-development.md)

### AIセッションログ

`logs/` は、保存を希望したAI開発セッションのやり取りを保存する。各セッションは `YYYYmmddHHMMSS-<title>/transcript.md` に、目的と発話順の記録を持つ。
