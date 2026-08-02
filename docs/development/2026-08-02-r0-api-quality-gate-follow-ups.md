# R0 API quality gate follow-ups

ローカル静的品質ゲート（`apps/api` の `npm run check` = lint → jscpd → knip → typecheck）導入後に残る作業。着手条件と成果物を肯定形で定義する。

## Completed

### Local static gate session

- `apps/api` で `npm run lint` / `jscpd` / `knip` / `typecheck` / `check` を実行できる。
- TypeScript 7 でビルドし、typescript-eslint 向けに `@typescript/typescript6` を `typescript` として side-by-side 利用する。

### 1. PR / main の GitHub Actions

- **成果物:** `.github/workflows/pull-request.yml` と `.github/workflows/main-publish.yml` が `apps/api` で `npm ci` のあと `npm run check` を実行する。
- **参照:** `docs/specs/2026-07-26-hono-api-r0-design.md` の「継続的提供」

## Follow-up work

### 2. jscpd SARIF → GitHub Code Scanning

- **着手条件:** GitHub Actions が API package の静的ゲートを実行する。
- **成果物:** CI が jscpd の SARIF を出力し、GitHub Code Scanning が PR 上に新規重複を表示する。
- **参照:** 同上「コード品質」「継続的提供」

### 3. `npm run e2e` と `check` への組み込み

- **着手条件:** API E2E、worker E2E、仕様ルール対応表がリポジトリに存在する。
- **成果物:** `npm run e2e` が対応表と成功 scenario を照合し、`npm run check` が lint → jscpd → knip → typecheck → e2e の順で実行する。
- **参照:** 同上「コード品質」「E2E検証」

### 4. knip entry の拡張

- **着手条件:** worker、migration command、E2E runner の entry file が追加される。
- **成果物:** `apps/api/knip.json` の `entry` がそれらの path を含み、到達しない export / file / dependency / import を検出する。
- **参照:** 同上「コード品質」

### 5. `apps/mobile` の静的品質ゲート

- **着手条件:** mobile パッケージに API と同等のローカル検証を入れる判断が確定する。
- **成果物:** mobile 向けの lint / 重複 / デッドコード / typecheck のローカル command と、必要なら CI への組み込み。
- **参照:** この文書は API ゲートの後続。mobile は別作業単位として着手する。
