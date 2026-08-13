---
name: organizing-mobile-api-clients
description: Expo モバイルで API 呼び出しを追加、移動、分割するときに、機能単位の `lib/<feature>-api.ts`、共通 `api.ts`、セッションなどの非 HTTP モジュールの配置を決める。route ファイルへ `apiRequest` を書く、または endpoint ごとの helper ファイルを切るときに使用する。
---

# モバイル API クライアントの構成

画面は HTTP を直接書かず、機能名から呼び出しを追跡できる配置にする。共通 transport と機能契約を分け、セッションや端末状態は HTTP モジュールに混ぜない。

## 配置

| 対象 | 配置 |
| --- | --- |
| 共通 `fetch`、Bearer、204、エラー envelope | `apps/mobile/src/lib/api.ts` |
| `/v1/<feature>/*` の helper と応答型 | `apps/mobile/src/lib/<feature>-api.ts` |
| Secure Store セッション、React auth context | `apps/mobile/src/lib/auth.tsx` |
| HTTP ではない端末状態（Active Walk の有無など） | その状態のモジュール（例: `active-walk.ts`） |
| 画面 | `apps/mobile/src/app/` の route。default export の UI だけ |

型は `apps/mobile/src/lib/auth-api.ts`（`startSignIn`、`startSignUp`、`verifySignIn`、`verifySignUp`、`signOut`）。

## 規則

- `app/` の route は `apiRequest` を直接呼ばない。機能の `*-api.ts` を呼ぶ。
- endpoint ごとのファイル（例: `sign-out.ts`）は作らない。
- ある機能の helper を切るときは、同じ `/v1/<feature>/*` のインライン `apiRequest` も同じ変更で `lib/<feature>-api.ts` へ移す。
- `api.ts` に path を足し続けない。
- `auth.tsx` に HTTP を混ぜない。画面が `signOut` のあとに `clearSession` のように順序を組む。

## ワークフロー

1. 追加する path の機能名（auth、owners、walks など）を API の機能境界と同じ単位で決める。
2. `lib/<feature>-api.ts` が無ければ作る。既存ならそこに helper と応答型を足す。
3. 同じ機能の他画面・他 helper が `apiRequest('/v1/<feature>/...')` を直書きしていれば、同じ変更で移す。
4. route は default export の画面だけ残し、named HTTP helper を `app/` に置かない。

## 完了条件

- 変更した画面は `apiRequest` を import しない。
- その機能の `/v1/<feature>/*` 呼び出しが 1 つの `lib/<feature>-api.ts` に揃っている。
- セッションや端末状態モジュールに HTTP を追加していない。
