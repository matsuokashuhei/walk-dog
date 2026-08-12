# Sign Out 仕様書

> WHAT → HOW → WHY

## WHAT

認証済み Owner が Sign Out する。Active Walk がある場合は確認ダイアログを表示し、承諾後に Active Walk を Failed として破棄してから Sign Out する。Active Walk がない場合は確認なしで Sign Out する。成功後はローカル session を削除し Sign In を表示する。

### 画面

#### HTML モック

`docs/logs/20260812175057-r1-step1-sign-out/sign-out-spec-mockups.html`

| ID | 状態 | Route | 表示内容 |
| --- | --- | --- | --- |
| SETTINGS-01 | Idle | `/settings` | 法務リンクと Sign Out |
| SETTINGS-02 | Confirm | `/settings` | Active Walk 破棄確認ダイアログ |
| SETTINGS-03 | Signing out | `/settings` | 進行表示。再操作を受け付けない |
| SETTINGS-04 | Error | `/settings` | 失敗メッセージと再試行可能な Sign Out |
| AUTH-01 | After Sign Out | `/sign-in` | 未認証の Sign In |

Settings は Sign Out と法務リンク（利用規約、プライバシーポリシー、アプリ情報）を提供する。

#### コンポーネント

| コンポーネント | 説明 |
| --- | --- |
| Settings title | 画面タイトル `Settings` |
| Legal links | 利用規約、プライバシーポリシー、アプリ情報。既存の公開文書を開く |
| Sign Out button | Sign Out を開始する主操作 |
| Active Walk confirm dialog | Active Walk があるときに表示する。破棄して Sign Outする操作と、キャンセル操作を持つ |
| Signing-out indicator | Sign Out API 呼び出し中の進行表示 |
| Error message | Sign Out 失敗時のメッセージ |

#### イベント

| イベント | 前提 | 結果 |
| --- | --- | --- |
| Open legal link | Settings 表示中 | 対象の公開文書を開く |
| Tap Sign Out | Active Walk なし | Sign Out API を呼び出す |
| Tap Sign Out | Active Walk あり | 確認ダイアログを表示する。API はまだ呼ばない |
| Confirm discard | 確認ダイアログ表示中 | Active Walk を Failed にする Sign Out API を呼び出す |
| Cancel discard | 確認ダイアログ表示中 | ダイアログを閉じる。Active Walk と session を維持する |
| Sign Out success | API が 204 | ローカル token を削除し Sign In を表示する |
| Sign Out failure | API が失敗 | Settings に留まり、エラーを表示する。同じ Sign Out で再試行できる |

#### 画面遷移

```text
Settings (Idle)
  ├─ Active Walk なし + Sign Out → Signing out → Sign In
  ├─ Active Walk あり + Sign Out → Confirm
  │     ├─ キャンセル → Idle（Walk と session を維持）
  │     └─ 破棄して Sign Out → Signing out → Sign In
  └─ Signing out 失敗 → Error → Sign Out 再試行
```

### API

#### `POST /v1/auth/sign-out`

認証済み Owner の Cognito session を無効化する。対象 Owner に Active Walk がある場合、その Active Walk を Failed にしてから session を無効化する。

##### リクエスト

| 項目 | 値 |
| --- | --- |
| Method | `POST` |
| Path | `/v1/auth/sign-out` |
| Auth | `Authorization: Bearer <accessToken>` |
| Body | 空オブジェクト `{}`、または body なし |

```ts
type SignOutRequest = Record<string, never> | undefined
```

リクエスト body の許容値は空オブジェクト `{}` または body 省略のみとする。Active Walk がある場合の Failed 化はサーバーが Sign Out 成立時に行う。

##### 成功レスポンス

| 項目 | 値 |
| --- | --- |
| Status | `204 No Content` |
| Body | 空 |

##### 失敗レスポンス

共通 envelope:

```ts
type ApiErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}
```

| 状態 | Status | code | retryable |
| --- | --- | --- | --- |
| access token 未指定・無効・期限切れ・claim 不一致 | `401` | `UNAUTHENTICATED` | `false` |
| 入力不正 | `400` | `INVALID_INPUT` | `false` |
| 依存サービスの一時失敗 | 契約上の再試行可能 status | 依存に対応する code | `true` |

401 の message は `Authentication is required.` とする。

##### 振る舞い

1. Bearer access token を検証する（署名、期限、issuer、User Pool、App Client、`token_use=access`）。
2. 検証済み subject に対応する Owner を特定する。
3. その Owner に Active Walk がある場合、Active Walk を Failed にする。
4. Cognito session を無効化する。
5. `204 No Content` を返す。

Active Walk がない場合、手順 3 をスキップして手順 4 へ進む。

クライアントは Active Walk の有無で確認ダイアログの表示を決める。API は確認ダイアログの結果を受け取らず、Sign Out が成立した時点で Active Walk を Failed にする。

## HOW

1. Settings が Active Walk の有無を参照する。
2. Active Walk ありなら確認ダイアログを表示し、承諾後にだけ `POST /v1/auth/sign-out` を送る。
3. Active Walk なしなら直ちに `POST /v1/auth/sign-out` を送る。
4. API は token 検証、Active Walk の Failed 化、Cognito session 無効化の順で処理する。
5. モバイルは `204` 後に Secure Store の access / ID / refresh token を削除し、Sign In を表示する。

## WHY

- Owner が記録中の散歩を黙って失わないよう、Active Walk があるときは確認する。
- 確認後の Sign Out では Active Walk を常に Failed にし、途中記録のまま session だけ消える状態を作らない。
- R1 アカウント縦切りの Sign Out と、AC-AUTH-05（破棄承諾 → Failed → Sign In）に整合する。
- Sign Out 成立時の Active Walk 扱いは Failed に一意化する。
