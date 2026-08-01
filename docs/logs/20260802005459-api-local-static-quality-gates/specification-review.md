# Specification review

- status: ready
- purpose: Add local static quality gates to `apps/api` and record deferred follow-ups under `docs/development` with a progress link from `staged-development.md`
- active release: R0

## Sources

| Source | Supporting section | Conclusion |
| --- | --- | --- |
| `docs/development/staged-development.md` | R0、進捗状況、検証 | R0進行中。品質ゲート自体は段階計画に列挙されていないが、R0のAPI基盤整備と整合する。 |
| `docs/specs/2026-07-26-hono-api-r0-design.md` | コード品質 | `npm run lint` / `jscpd` / `knip` / `typecheck` / `check` を定義。production source の上限と ESLint ゲートを定義。 |
| `docs/logs/20260726141518-decide-and-execute-development/transcript.md` | CIとPR前ローカル検証のコード品質ゲート | 記事と同じ4本柱をPR前ローカル検証へ組み込む判断が記録されている。 |
| `apps/api/package.json` | scripts / devDependencies | lint / jscpd / knip / typecheck / check は未実装。 |

## Current-release deliverables

- `apps/api` で `npm run lint` が ESLint、SonarJS、TypeScript strict type-aware rules を実行する。
- `apps/api` で `npm run jscpd` が production source の重複を検出する。
- `apps/api` で `npm run knip` が unused export / file / dependency / import を検出する。
- `apps/api` で `npm run typecheck` が TypeScript compile を実行する。
- `apps/api` で `npm run check` が上記静的ゲートを順に実行する。
- `docs/development/2026-08-02-r0-api-quality-gate-follow-ups.md` が後続作業を記録する。
- `docs/development/staged-development.md` の進捗状況が follow-up 文書へリンクする。

## Decision classifications

| Decision | Classification | Reason |
| --- | --- | --- |
| 今回はローカル静的ゲートのみ（CI / E2E / mobile は後続） | implementation-local | 設計のコード品質節の一部実装。リリース順序・提供機能は変えない。 |
| follow-up 文書を `docs/development` に置き、進捗状況からリンクする | implementation-local | 作業発見用の索引。承認済み判断・提供機能の変更ではない。 |
| `check` から `e2e` を当面外す | deferred release decision | E2E 未実装。後続文書に着手条件を記録する。 |
| GitHub Actions / SARIF Code Scanning | deferred release decision | R0設計「継続的提供」の未実装分。後続文書に記録する。 |

## Verification conditions

- `cd apps/api && npm run lint && npm run jscpd && npm run knip && npm run typecheck && npm run check` が成功する。
- 既存 `npm test` が成功する。
- follow-up 文書と `staged-development.md` の進捗リンクが存在する。

## Next permitted action

implementation
