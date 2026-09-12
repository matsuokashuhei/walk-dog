# 実機検証 設計

> WHAT → HOW → WHY

## WHAT

R1 Step 7 の実機検証を提供する。Owner は Recording 中にアプリを再起動・Background 退避・タブ移動しても Active Walk を失わず、位置取得と送信が継続し、通信復帰後に未送信点が流れる。

| 提供 | 内容 |
| --- | --- |
| 起動復元 | API に Active Walk があるとき、再起動後の Walk 表示で Recording を復元する |
| Foreground 照合 | AppState `active` 復帰で Active Walk を再照合する |
| タブ移動照合 | Walk タブ focus で同じ照合を行う |
| Background 位置 | 許可済みなら 10 秒間隔の TrackPoint 取得・送信が継続する |
| Active 消失 | 照合で Active が無いとき Failed を表示する |
| 通信復帰 | Recording 中、未送信 TrackPoint を回数上限なく自動再送する |

受け入れ:

| 対象 | 入力 | 結果 |
| --- | --- | --- |
| AC-WALK-03 | Active Walk あり + アプリ再起動 + Walk 表示 | Recording 復元 |
| Foreground | Recording 中に Home 退避 → 復帰 | Recording 維持。Active 無しなら Failed |
| タブ移動 | Recording 中に Dogs → Walk | 再照合。Recording 維持 |
| AC-WALK-04 | Recording + Background | TrackPoint 継続（通信可能なら API 到達） |
| AC-WALK-06 | Recording + Active 消失 | Failed |
| 通信復帰 | Recording 中の一時不通 → 復帰 | 未送信点が自動再送。画面は Recording |

画面契約: `device-verification-spec-mockups.html`。新規 HTTP 契約は無い。

受け入れ環境: iPhone 実機 + 同一 LAN のローカル Compose API。VPS API 実機は後続。

## HOW

### 方針

既存の照合・位置・キュー実装を契約に照らして直し、実機証跡で閉じる。ライフサイクル専用モジュールは切り出さない。

### 流れ

```text
起動 / Walk focus / Foreground active:
  getActiveWalk
    → Active あり → Recording（経路再読込、位置タスク再装着）
    → Active なし + 端末 Recording → Failed
    → Active なし + Ready 系 → Ready 更新

Recording + Background:
  WALK_TRACK_POINT / サンプル → outbound キュー → POST /track-points
  失敗点はキュー保持。次の sample / flush で再送

位置許可喪失 (Recording):
  deleteWalk → Failed
```

### 部品

| 部品 | 役割 |
| --- | --- |
| `apps/mobile/src/app/(app)/(tabs)/walk.tsx` | `load` / `verifyRecording` / focus / AppState |
| `apps/mobile/src/lib/location-permission.ts` | Foreground 復帰時の分岐 |
| `apps/mobile/src/lib/walk-location-task.ts` | Background 位置と flush |
| `apps/mobile/src/lib/walk-track-point-queue.ts` | 未送信保持と再送 |
| `apps/mobile/README.md` | 実機 LAN の `EXPO_PUBLIC_API_BASE_URL` 手順 |
| セッション E2E 証跡 | brief / report / 画面 |

### 失敗

| 状況 | 表示 / 操作 |
| --- | --- |
| 照合で Active なし | Failed。Ready へ戻れる |
| 位置許可喪失 | Failed（`deleteWalk`） |
| 照合 API 一時失敗 | 現状態を維持。次の focus / Foreground で再試行 |
| TrackPoint 送信失敗 | Recording 維持。キュー自動再送 |
| LAN / Compose 不通 | 接続手順を直して再試行 |

### 検証

1. ユニット。AppState / キュー。ギャップ修正があればテストを追加する。
2. 実機 E2E（必須）。起動復元、Foreground、タブ移動、Background、Active 消失、通信復帰。
3. 環境。Compose up、端末から到達する API URL、位置 foreground + background 許可。`EXPO_PUBLIC_*` 変更後は native rebuild。

### 完了条件

実機シナリオの証跡が揃い、発見したギャップ修正がブランチに入っていること。

## WHY

縦切り 7 の価値はアーキテクチャ整理ではなく、散歩記録が実機ライフサイクルで壊れないことの証明である。骨格は main にある。足りないのはギャップ修正と実機証跡である。
