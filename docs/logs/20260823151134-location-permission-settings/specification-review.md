# Specification review

- status: ready
- Purpose: Walk Ready で拒否済みの位置情報権限を設定画面へ案内する
- Active release: R1
- next permitted action: implementation

## Sources

1. `docs/development/staged-development.md`
   - R1 の Walk Ready は Dog 選択と foreground / background 位置情報許可が揃うと開始でき、不足条件は理由を表示する。
   - iOS 位置情報権限は foreground / background 許可、開始条件、現在地取得の土台であり、位置情報許可変更を iPhone で検証する。
2. `docs/specs/external-specification.html`
   - Walk Ready は同じ Owner の Dog を1頭以上選択し、foreground / background 位置情報を許可すると開始条件を満たす。不足条件は理由を表示する。
3. `docs/development/2026-08-15-r1-step3-active-walk-plan.md`
   - 位置情報は foreground のあと background を要求し、両方許可されたときだけ地図と Start を有効にする。
   - Ready の位置情報不足は理由と許可操作を表示する。

## Screen contract

- Ready で Dog を1頭以上選択済み、かつ foreground / background のいずれかが拒否済みのとき、画面は「位置情報（使用中および常に）を設定で許可してください。」と「設定を開く」操作を表示する。
- 「設定を開く」はアプリ設定画面を開く。Walk 画面へ戻ると foreground / background の現在の許可状態を読み取り、両方が許可されたとき「開始する」を有効にする。
- foreground / background のいずれも拒否されていないとき、画面は既存の「位置情報を許可」操作から foreground、次に background の許可を要求する。

## Decisions

- Implementation-local (confirmed): いずれかの権限が拒否済みなら設定画面へ案内する。両方許可済み、または初回許可要求の順序は既存契約を維持する。
- Public API / database: 変更しない。

## Verification conditions

- 両方許可済みは開始可能な位置情報状態になる。
- 未決定の権限は既存の許可要求操作を表示する。
- foreground または background が拒否済みの権限は設定画面を開く操作を表示する。
- iOS Simulator で拒否済みの状態から設定画面を開き、両方許可後に開始可能になる。
