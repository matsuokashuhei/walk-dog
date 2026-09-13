# 物理 iPhone に開発クライアントを入れる

ローカル Compose API に繋ぐ walk / dog の development client を、物理 iPhone へ入れて起動する。

この手順は R1 Step 7 実機検証で **Build Succeeded / インストール成功 / Metro 接続 / Sign In 表示** まで通った経路だけを書く。シミュレータ向け手順と Expo Go は対象外。

証跡: [docs/logs/20260906172837-r1-step7-device-verification/e2e-report.md](../logs/20260906172837-r1-step7-device-verification/e2e-report.md)（`status: passed`、2026-09-12）。

## 始める前に

次を満たす。

1. Mac に Xcode と Docker Desktop がある。
2. Apple Developer Program に参加しており、[developer.apple.com/account](https://developer.apple.com/account) で最新の Program License Agreement に同意済みである。未同意だと `com.cacheandbuffer.walkdog` の開発プロファイルが取れずインストールが止まる。
3. 物理 iPhone が Mac と同じ Wi-Fi にあり、USB で接続されている。
4. iPhone のロックが解除されている。ロック中は Developer Disk Image の mount とインストールが失敗する。
5. iPhone で Developer Mode がオンである。
6. 端末が Xcode / CoreDevice に見える。確認例:

```bash
xcrun xctrace list devices
xcrun xcdevice list
```

一覧に自分の iPhone が出る。UDID を控える。

## Compose を起動し LAN 到達を確認する

```bash
cd apps
cp .env.example .env.local   # 未作成のときだけ
docker compose -f compose.yml up --build -d
```

`.env.local` の Cognito / AWS 値は [README.md](../../README.md) と [infra/README.md](../../infra/README.md) に従う。

Mac の LAN IP を取り、health を二重確認する。

```bash
ipconfig getifaddr en0
curl --fail http://127.0.0.1:3000/health
curl --fail http://<mac-lan-ip>:3000/health
```

両方とも HTTP 200 を返す。電話が使う URL は後者である。`127.0.0.1` は電話上では電話自身を指すので使わない。

macOS ファイアウォールが聞いたら、inbound TCP 3000（API）と Metro 用ポート（この手順では 8082）を許可する。

## API 先を電話向けに書く

```bash
cd apps/mobile
cp .env.example .env   # 未作成のときだけ
```

`apps/mobile/.env` を次にする。

```
EXPO_PUBLIC_API_BASE_URL=http://<mac-lan-ip>:3000
```

実測例: `EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000`。

`EXPO_PUBLIC_*` を変えたあとは、次節のネイティブ再ビルドが必要である。

## ビルドして iPhone に入れる

```bash
cd apps/mobile
npm install
```

接続中の端末 UDID を指定して入れる。

```bash
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=http://<mac-lan-ip>:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=<mac-lan-ip> \
  npx expo run:ios --device <udid> -p 8082
```

実測例:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.68.64:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.64 \
  npx expo run:ios --device 00008120-001A2DE83A3B401E -p 8082
```

`REACT_NATIVE_PACKAGER_HOSTNAME` は電話が Metro を LAN 経由で見つけるために必要である。省略すると packager が loopback 向きになり、電話から届かない。

初回は prebuild で `apps/mobile/ios/` が生成され、CocoaPods と xcodebuild が走る。成功時は Build Succeeded のあと `com.cacheandbuffer.walkdog` が端末に入る。

端末が 1 台だけなら `--device` に UDID を省略できることもある。複数台や認識トラブルがあるときは UDID を明示する。

## Metro に繋いで起動する

`expo run:ios` が Metro を 8082 で起動したままなら、そのプロセスを使う。別途起動するとき:

```bash
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=http://<mac-lan-ip>:3000 \
  REACT_NATIVE_PACKAGER_HOSTNAME=<mac-lan-ip> \
  npx expo start --port 8082 --lan --dev-client
```

アプリを Metro URL 付きで起動する例:

```bash
xcrun devicectl device process launch --device <udid> --activate \
  --payload-url 'exp+walk-dog://expo-development-client/?url=http%3A%2F%2F<mac-lan-ip>%3A8082' \
  com.cacheandbuffer.walkdog
```

ホーム画面から **mobile**（bundle id `com.cacheandbuffer.walkdog`）を開き、dev client の UI で同じ Metro URL を選んでもよい。

## 成功の見え方

次を確認する。

1. 端末上にアプリが入っている。
2. Metro が生きている。例: `curl --fail http://127.0.0.1:8082/status` が 200。
3. アプリが JS を読み込み、Sign In（または既に認証済みなら Dogs / Walk）が出る。
4. 必要なら `curl --fail http://<mac-lan-ip>:3000/health` が引き続き 200。

Walk の Recording まで触るときは、位置情報の **使用中** と **常に** を許可する。Cognito の OTP が要るときは `aws sts get-caller-identity --profile walk-dog` が通っていること。

## 止まったとき

| 症状 | 対処 |
| --- | --- |
| プロファイル取得失敗 / xcodebuild 65 | [developer.apple.com/account](https://developer.apple.com/account) で Program License Agreement に同意し、再実行する |
| DDI / install 失敗 | iPhone のロックを解除し、USB 接続のまま Auto-Lock をオフにする |
| 端末が一覧に出ない | USB ケーブルを差し直し、信頼ダイアログがあれば許可する。Developer Mode を確認する |
| API が電話から届かない | `.env` が `127.0.0.1` になっていないか見る。LAN health を再確認する。`EXPO_PUBLIC_*` 変更後に再ビルドする |
| Metro に繋がらない | `REACT_NATIVE_PACKAGER_HOSTNAME=<mac-lan-ip>` と `-p 8082` を付け直す。ファイアウォールで 8082 を許可する |

EAS の `development` プロファイルは `apps/mobile/eas.json` で `ios.simulator: true` になっている。この手順の物理インストール経路ではない。

## 関連

- シミュレータ起動: [README.md](../../README.md)
- モバイル開発メモ: [apps/mobile/README.md](../../apps/mobile/README.md)
- 実機受け入れシナリオ: [e2e-codex-brief.md](../logs/20260906172837-r1-step7-device-verification/e2e-codex-brief.md)
