# R1 Step 7 Device Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** iPhone 実機 + ローカル Compose で、起動／Foreground／タブ移動の Active Walk 照合、Background 位置継続、Active 消失 → Failed、通信復帰の自動再送を契約どおり証明し、足りない分岐だけ直す。

**Architecture:** 既存の `walk.tsx` / `walk-location-task` / TrackPoint キューを維持する。照合の決定だけを純関数 `walk-reconcile.ts` に寄せてユニットで固定し、画面から呼ぶ。ライフサイクル専用レイヤや新規 HTTP は作らない。受け入れは物理 iPhone の E2E 証跡で閉じる。

**Tech Stack:** Expo SDK 57、Expo Location / TaskManager、Node.js test runner、Docker Compose、Cognito OTP helper

**Spec:** `docs/logs/20260906172837-r1-step7-device-verification/design.md`、`device-verification-spec-mockups.html`、`specification-review.md`

## Global Constraints

- 公開契約は `device-verification-spec-mockups.html` と `design.md` に従う。
- 受け入れ環境は iPhone 実機 + 同一 LAN のローカル Compose API。シミュレータのみの合格は認めない。
- `EXPO_PUBLIC_API_BASE_URL` は端末から到達可能な絶対 URL（`127.0.0.1` ではない）。変更後は native rebuild。
- 新規 HTTP エンドポイントは追加しない。使う既存 API は `GET /v1/walks/active`、`POST /v1/walks/:walkId/track-points`、必要時 `DELETE /v1/walks/:walkId`。
- ライフサイクル専用モジュールツリーは切り出さない。純関数の照合決定のみ可。
- TrackPoint 再送は Recording 中に回数上限なし。専用 NetInfo リスナは追加しない。
- collaborator は required 注入。Quiet no-op を production factory に埋め込まない。
- コマンドは指定がなければ `apps/mobile` から実行する。
- 各 Task は targeted test → 関連 gate → commit。
- Worktree: `.worktrees/agent/r1-step7-device-verification-20260906172837`。ブランチ: `agent/r1-step7-device-verification-20260906172837`。
- 画面契約セッションの公開前に `recording-ios-e2e-evidence` の証跡が必須。

## File map

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/lib/walk-reconcile.ts` | Active Walk 照合の純関数決定 |
| `apps/mobile/src/lib/walk-reconcile.test.ts` | 照合決定のユニット |
| `apps/mobile/src/app/(app)/(tabs)/walk.tsx` | `load` / `verifyRecording` から純関数を呼ぶ |
| `apps/mobile/src/lib/location-permission.ts` | 既存 AppState 分岐（変更最小） |
| `apps/mobile/README.md` | 実機 LAN の API URL 手順 |
| `docs/logs/20260906172837-r1-step7-device-verification/e2e-codex-brief.md` | 実機 E2E 手順 |
| `docs/logs/20260906172837-r1-step7-device-verification/e2e-report.md` | 実行結果 |
| `docs/logs/20260906172837-r1-step7-device-verification/screenshots/*.png` | 必須画面証跡 |

## Shared types (all tasks)

```ts
export type RecordingVerifyDecision =
  | { action: 'keep' }
  | { action: 'fail_walk' }
  | { action: 'mark_failed' }

export function decideRecordingVerify(input: {
  locationGranted: boolean
  activeWalk: { walkId: string } | null
}): RecordingVerifyDecision

export type WalkLoadDecision =
  | { kind: 'recording'; walk: { walkId: string } }
  | { kind: 'ready' }

export function decideWalkLoad<T extends { walkId: string }>(
  activeWalk: T | null,
): WalkLoadDecision & (T extends never ? never : { walk?: T })
```

`decideRecordingVerify`:

- `locationGranted === false` → `{ action: 'fail_walk' }`（既存どおり `deleteWalk` して Failed）
- `activeWalk === null` → `{ action: 'mark_failed' }`
- otherwise → `{ action: 'keep' }`

`decideWalkLoad`:

- `activeWalk !== null` → Recording にその walk
- `activeWalk === null` → Ready 組み立てへ（dogs / selection は呼び出し側）

---

### Task 1: Active Walk 照合の純関数とユニット

**Files:**
- Create: `apps/mobile/src/lib/walk-reconcile.ts`
- Create: `apps/mobile/src/lib/walk-reconcile.test.ts`
- Modify: `apps/mobile/src/app/(app)/(tabs)/walk.tsx`（`verifyRecording` / `load` の分岐を純関数呼び出しに寄せる）

**Interfaces:**
- Consumes: なし（純関数）
- Produces: `decideRecordingVerify`、`decideWalkLoad`

- [x] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { decideRecordingVerify, decideWalkLoad } from './walk-reconcile.ts'

test('keep recording when location is granted and active walk exists', () => {
  assert.deepEqual(
    decideRecordingVerify({
      locationGranted: true,
      activeWalk: { walkId: 'w1' },
    }),
    { action: 'keep' },
  )
})

test('fail walk when location is not granted during recording verify', () => {
  assert.deepEqual(
    decideRecordingVerify({
      locationGranted: false,
      activeWalk: { walkId: 'w1' },
    }),
    { action: 'fail_walk' },
  )
})

test('mark failed when active walk is missing', () => {
  assert.deepEqual(
    decideRecordingVerify({
      locationGranted: true,
      activeWalk: null,
    }),
    { action: 'mark_failed' },
  )
})

test('load decides recording when active walk exists', () => {
  const walk = { walkId: 'w1' }
  assert.deepEqual(decideWalkLoad(walk), { kind: 'recording', walk })
})

test('load decides ready when active walk is absent', () => {
  assert.deepEqual(decideWalkLoad(null), { kind: 'ready' })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && node --import tsx --test src/lib/walk-reconcile.test.ts`  
Expected: FAIL（module not found）

- [x] **Step 3: Implement minimal `walk-reconcile.ts`**

```ts
export type RecordingVerifyDecision =
  | { action: 'keep' }
  | { action: 'fail_walk' }
  | { action: 'mark_failed' }

export function decideRecordingVerify(input: {
  locationGranted: boolean
  activeWalk: { walkId: string } | null
}): RecordingVerifyDecision {
  if (!input.locationGranted) {
    return { action: 'fail_walk' }
  }
  if (input.activeWalk === null) {
    return { action: 'mark_failed' }
  }
  return { action: 'keep' }
}

export function decideWalkLoad<T extends { walkId: string }>(
  activeWalk: T | null,
): { kind: 'recording'; walk: T } | { kind: 'ready' } {
  if (activeWalk !== null) {
    return { kind: 'recording', walk: activeWalk }
  }
  return { kind: 'ready' }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && node --import tsx --test src/lib/walk-reconcile.test.ts`  
Expected: PASS

- [x] **Step 5: Wire into `walk.tsx`**

`verifyRecording` 内:

1. `locationAction !== 'granted'` のとき `decideRecordingVerify({ locationGranted: false, activeWalk: current.walk })` → `fail_walk` 分岐（既存の `deleteWalk` → Failed）
2. `getActiveWalk` 後に `decideRecordingVerify({ locationGranted: true, activeWalk: walk })` → `mark_failed` なら Failed、`keep` なら何もしない

`load` 内の `walk !== null` 分岐を `decideWalkLoad(walk)` に置き換える。Ready 組み立てロジックは現状どおり呼び出し側に残す。

挙動を変えない。分岐の所有を純関数に移すだけ。

- [x] **Step 6: Run mobile tests and typecheck**

Run:

```bash
cd apps/mobile
npm test
npx tsc --noEmit
```

Expected: PASS（既存 50 + 新規 5）

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/walk-reconcile.ts \
  apps/mobile/src/lib/walk-reconcile.test.ts \
  apps/mobile/src/app/\(app\)/\(tabs\)/walk.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): fix Active Walk reconcile decisions in pure helpers

EOF
)"
```

---

### Task 2: 実機 LAN Compose 接続手順

**Files:**
- Modify: `apps/mobile/README.md`
- Modify: `apps/mobile/.env.example`（コメントで実機例を足す。値のデフォルトはシミュレータ用のままでよい）

**Interfaces:**
- Consumes: なし
- Produces: 実行者が実機から Compose API に届ける手順

- [x] **Step 1: Document physical-device API URL**

`apps/mobile/README.md` の Environment 節に次を追加する（文言はこのまま）:

```markdown
### Physical iPhone (same LAN as Compose)

Simulator can use `http://127.0.0.1:3000`. A physical device cannot.

1. Start Compose from `apps/` (`docker compose -f compose.yml up --build -d`).
2. Confirm `curl --fail http://127.0.0.1:3000/health` on the Mac.
3. Find the Mac LAN address (e.g. `ipconfig getifaddr en0`).
4. Set the device-reachable URL in `apps/mobile/.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://<mac-lan-ip>:3000
```

5. Rebuild the native app (`npx expo run:ios --device`) after any `EXPO_PUBLIC_*` change.
6. Ensure the iPhone and Mac share Wi-Fi, and that macOS firewall allows inbound TCP 3000 if prompted.
```

`.env.example` にコメント行を追加:

```
# Physical device example (not for Simulator):
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/README.md apps/mobile/.env.example
git commit -m "$(cat <<'EOF'
docs(mobile): document LAN API URL for physical iPhone

EOF
)"
```

---

### Task 3: 実機 E2E brief

**Files:**
- Create: `docs/logs/20260906172837-r1-step7-device-verification/e2e-codex-brief.md`

**Interfaces:**
- Consumes: `design.md`、`device-verification-spec-mockups.html`、Task 2 の LAN 手順
- Produces: 実行可能な実機シナリオ一覧と必須 PNG 名

- [x] **Step 1: Write the brief**

必須シナリオと PNG:

| ID | シナリオ | 必須 PNG |
| --- | --- | --- |
| A | 起動復元 AC-WALK-03 | `screenshots/ios-walk-reconcile-restart-recording.png` |
| B | Foreground 復帰 | `screenshots/ios-walk-reconcile-foreground-recording.png` |
| C | タブ移動 Dogs→Walk | `screenshots/ios-walk-reconcile-tab-recording.png` |
| D | Background 位置継続 AC-WALK-04 | `screenshots/ios-walk-background-trackpoint.png`（Recording 復帰後、経路が伸びている画面） |
| E | Active 消失 → Failed AC-WALK-06 | `screenshots/ios-walk-reconcile-active-missing-failed.png` |
| F | 通信復帰の自動再送 | `screenshots/ios-walk-network-recovery-recording.png`（復帰後も Recording、点が送れた証拠をレポートに書く） |

Brief に含める固定情報:

- Worktree 絶対パス
- Compose: `apps/compose.yml`、health `http://<lan-ip>:3000/health`
- OTP: `apps/mobile/scripts/e2e/fetch-cognito-otp.sh`、profile `walk-dog`
- Bundle id: `com.cacheandbuffer.walkdog`
- Maestro 禁止
- 物理 iPhone 必須（シミュレータ不可）
- Active 消失の作り方: Recording 中に API 側でその Walk を `failed` にするか、`DELETE /v1/walks/:walkId` を別クライアントから叩き、Foreground / タブ復帰で照合させる
- 通信復帰の作り方: Recording 中に Mac で API コンテナを一時 stop → 位置サンプルを溜める → start → キューが空になること / API に点が増えることを確認

- [x] **Step 2: Commit**

```bash
git add docs/logs/20260906172837-r1-step7-device-verification/e2e-codex-brief.md
git commit -m "$(cat <<'EOF'
docs: add R1 step 7 physical iPhone E2E brief

EOF
)"
```

---

### Task 4: 実機 E2E 証跡

**Files:**
- Create: `docs/logs/20260906172837-r1-step7-device-verification/screenshots/*.png`
- Create: `docs/logs/20260906172837-r1-step7-device-verification/e2e-report.md`
- Modify (only if gaps found): `apps/mobile/src/**` （最小修正。新規レイヤ禁止）

**Interfaces:**
- Consumes: Task 3 brief、Task 1–2 の成果
- Produces: `recording-ios-e2e-evidence` 合格セット

- [x] **Step 1: Preflight**

```bash
aws sts get-caller-identity --profile walk-dog
# fail → aws sso login --profile walk-dog して停止せずログイン後続行

cd apps && docker compose -f compose.yml up --build -d
curl --fail http://127.0.0.1:3000/health
curl --fail http://<mac-lan-ip>:3000/health
```

`apps/mobile/.env` の `EXPO_PUBLIC_API_BASE_URL` が LAN IP。必要なら `npx expo run:ios --device`。

- [x] **Step 2: Execute scenarios A–F**

`.agents/skills/recording-ios-e2e-evidence/SKILL.md` に従う。各必須 PNG を撮る。

シナリオが契約と食い違う（復元しない、Background で点が止まる、Active 消失で Failed にならない、復帰後もキューが流れない）場合:

1. 最小修正を入れる（Task 1 の純関数 / `walk.tsx` / `walk-location-task` / queue のみ）
2. 関連ユニットを追加または更新
3. `npm test` / `tsc --noEmit` を通す
4. 失敗したシナリオだけ再実行

専用ライフサイクル層は作らない。

- [x] **Step 3: Write `e2e-report.md`**

含める項目:

- 端末モデル / iOS バージョン
- API URL（LAN）
- 実行日時
- シナリオ A–F の結果（pass/fail）と観測内容
- 各 PNG の Markdown 埋め込み
- 通信復帰は API ログまたは DynamoDB / PG 受理件数など、点が届いた証拠を一文で書く

- [x] **Step 4: Parent verification**

必須 6 PNG が存在し、レポートが各 PNG を参照していることを確認する。委任実行なら監視ループをここで止める。

- [x] **Step 5: Commit**

```bash
git add docs/logs/20260906172837-r1-step7-device-verification/screenshots \
  docs/logs/20260906172837-r1-step7-device-verification/e2e-report.md \
  apps/mobile
git commit -m "$(cat <<'EOF'
test(e2e): record R1 step 7 device verification evidence

EOF
)"
```

ギャップ修正のコードがあれば同じコミットに含めてよい。修正が大きい場合は `fix(mobile): ...` を先に別コミットしてから証跡コミットする。

---

### Task 5: Session verification gate

**Files:**
- Modify: `docs/logs/20260906172837-r1-step7-device-verification/transcript.md`
- Modify: `docs/logs/20260906172837-r1-step7-device-verification/plan.md`（checkbox）

- [x] **Step 1: Run package gates**

```bash
cd apps/mobile && npm test && npx tsc --noEmit && npm run lint
# knip があればリポジトリの mobile / 該当 check も実行
cd ../api && npm test
```

Expected: すべて PASS

- [x] **Step 2: Confirm artifacts**

必須:

- `design.md`
- `device-verification-spec-mockups.html`
- `specification-review.md`（ready）
- `e2e-codex-brief.md`
- `e2e-report.md`
- シナリオ A–F の 6 PNG

- [x] **Step 3: Update transcript completion note**

Purpose・証跡・コミット一覧を揃える。

- [x] **Step 4: Commit session docs**

```bash
git add docs/logs/20260906172837-r1-step7-device-verification
git commit -m "$(cat <<'EOF'
docs: complete R1 step 7 device verification session record

EOF
)"
```

---

## Self-review

1. **Spec coverage:** AC-WALK-03/04/06、Foreground、タブ移動、通信復帰、実機+Compose → Tasks 1–4。
2. **Placeholder scan:** TBD なし。Active 消失と通信復帰の再現手順を Task 3 に固定。
3. **Type consistency:** `decideRecordingVerify` / `decideWalkLoad` を Task 1 で定義し、以降はそれを使う。

## Out of scope

| 項目 | 扱い |
| --- | --- |
| VPS API 実機 | Deferred |
| ライフサイクル層の切り出し再設計 | Declined（アプローチ 3） |
| 新規 HTTP / OpenAPI 追加 | 含めない |
| 履歴一覧 / Avatar / R2 | 含めない |
| シミュレータのみの合格 | 認めない |
