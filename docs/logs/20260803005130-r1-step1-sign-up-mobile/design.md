# Design: R1 Step 1 Sign Up Mobile

## WHAT

モバイルが Sign Up から OTP 確認までを完了し、認証済み状態でアプリを継続できる。

### Capabilities

1. Email で Sign Up を開始する。
2. OTP を確認して access / id / refresh token と Owner を受け取る。
3. トークンを端末に保存し、起動時に復元する。
4. 未認証時は Sign Up / Verify、認証済み時は認証済みシェルを表示する。
5. 失敗時は API の message を表示し、再試行操作を提供する。

### Accepted inputs

| Screen | Input |
| --- | --- |
| Sign Up | email |
| Verify | OTP code（sign-up 成功で得た username / session を保持） |

### Returned data / displayed states

| Flow | Success | Failure states |
| --- | --- | --- |
| Sign Up | username, session, codeDelivery → Verify へ遷移 | Loading → Error（message + 再試行） |
| Verify | tokens + owner 保存 → 認証済み暫定ホーム | Loading → Error（message + 再試行 / 最初から） |
| Launch | token あり → 認証済み / なし → Sign Up | — |

Confirmed scope: Sign Up Mobile only. Dogs List is R1 Step 2. API paths are `/v1/auth/sign-up` and `/v1/auth/verify`.

### Valid transitions

```
Unauthenticated → Sign Up (input)
  → Loading
  → Verify (username, session) | Error
Verify (input)
  → Loading
  → Authenticated | Error
Authenticated (launch with stored tokens)
Unauthenticated (launch without tokens)
```

## HOW

### Components

1. **API client** — `fetch` で `POST /v1/auth/sign-up` と `POST /v1/auth/verify` を呼ぶ。JSON 送受信。エラーは `{ code, message, requestId, retryable }` を抽出して返す。
2. **Auth state** — Secure Store に access / id / refresh token を保存・復元。React Context で認証状態と `setSession` / `clearSession` を提供する。
3. **Root layout** — AuthProvider で包み、認証状態で未認証 Stack（auth）と認証済み画面を分岐する。
4. **Sign Up screen** — email 入力 → sign-up API → Verify へ params 渡し。
5. **Verify screen** — OTP 入力 → verify API → token 保存 → 認証済みへ。

### Data flow

```
Sign Up screen
  → API client POST /v1/auth/sign-up { email }
  → { username, session, codeDelivery }
  → navigate Verify

Verify screen
  → API client POST /v1/auth/verify { username, session, code }
  → { accessToken, idToken, refreshToken, owner }
  → Auth state persist tokens
  → Authenticated shell
```

### Implementation plan (2 PRs)

| Task | Deliverable |
| --- | --- |
| Task 1 — Mobile API client + Auth state | API client、AuthProvider + Secure Store、Root layout の認証分岐 |
| Task 2 — Sign Up + Verify screens | auth Stack、Sign Up、Verify（Loading / Error / Retry） |

## WHY

- R1 Step 1 の前提表で「モバイル認証状態」「モバイル API クライアント」は必須。
- Sign Up API（PR #29/#30）は導入済み。Mobile 側が未着手のため、同じ Sign Up 能力を端末で成立させる。
- Sign In / 表示名 / Sign Out は R1 Step 1 残能力として別セッションに残す。
