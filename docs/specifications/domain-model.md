# 犬の散歩アプリ

飼い主が自分の犬を登録し、犬を選んで散歩を記録し、完了した散歩と日々の目標を振り返るドメイン。認証、犬、散歩記録、散歩履歴、飼い主の貢献、設定を一つの利用者向け言語でつなぐ。

## Language

### 人と所有対象

**Owner（飼い主）**:
アプリ上で自分の犬を管理し、散歩を開始・記録・閲覧する人。認証された利用者と同一視できる文脈では「利用者」ではなく Owner を使う。

Ownerプロフィールでは表示名を必須、アバターを任意とする。表示名変更とアバター変更は別々に保存する。

Owner表示名は前後空白を除去し、空文字を拒否する。最大100文字まで許可する。

対応言語は日本語・英語とする。初期値は端末の言語設定に合わせ、対応外の言語では英語を使用する。

距離・ペースの単位は初期値をkm（メートル法）とし、ユーザーがmile（ヤード・ポンド法）へ変更できる。

外観設定はLight・Dark・Systemの3択とし、初期値はSystem（端末設定に追従）とする。

通知設定は初期値をONとし、ユーザーがSettingsでOFFに変更できる。

SettingsにはSign Out、利用規約、プライバシーポリシー、アプリ情報を必須項目として配置する。利用規約とプライバシーポリシーはWebページを開く。

タイムゾーンはアプリ内で変更しない。Owner側で未設定の場合は端末のタイムゾーンを使用し、Today/Yesterdayと週間集計もこの基準で計算する。週間の開始日は月曜日とする。
_Avoid_: User、Account、Walker（散歩の担当者を指す場合）

**Account（アカウント）**:
Owner が認証に使うメールアドレスを中心とした認証上の資格。犬や散歩の所有対象そのものではない。
_Avoid_: User、Profile

**Dog（犬）**:
Owner が管理する散歩の対象。散歩には1頭以上の Dog が参加でき、同じ名前の Dog も ID で別個に扱う。
_Avoid_: Pet、Animal

同一Ownerが管理するDogではNameを重複させない。別Owner間の同名は許可する。

DogのGenderはMale、Female、Unknownのいずれかを表す。
Avatarは任意のDog画像で、未設定・追加・変更・削除を許可する。

Dog登録・編集の未保存変更をCancelする場合は確認ダイアログを表示し、破棄の承諾時だけ画面を離れる。キャンセル時は入力を保持する。

Dog登録成功後は登録したDogのDetailへ遷移し、BackでDog一覧へ戻る。



**Participant（参加犬）**:
特定の Walk に紐づく Dog。複数犬散歩では、同じ Walk が各 Participant の履歴に現れる。
_Avoid_: Walker（人を指す）、selected dog（準備中の選択状態だけを指す）

1つのWalkに参加できるDogは、同じOwnerが管理するDogに限る。

### 目標と散歩

**Goal（散歩目標）**:
Dogに対して一定期間に適用される散歩時間の目標。Goalは変更で上書きせず、有効期間を持つ不変の記録として履歴に残す。期間はDailyまたはWeeklyで、Dogごとに適用される。
_Avoid_: Target（画面上の一般語として使う場合）

**Goal Revision（散歩目標改定）**:
Dogの新しい散歩目標を適用する出来事。既存Goalのminutesやperiodを書き換えず、前のGoalを終了して新しいGoalを追加する。
_Avoid_: Goal update、Goal overwrite

Goalを変更した場合、変更前のGoalとその期間の進捗は保持し、変更時点以降の散歩には新しいGoalを適用する。

Goalのminutesは1分以上9999分以下、5分刻みとする。未指定時の初期GoalはDaily 30分とする。

Goal Revisionは変更APIが成功した時点から有効になる。変更に失敗した場合は旧Goalを維持する。

進行中のWalkがGoal変更をまたいだ場合、そのWalkは完了時点で有効なGoalへ集計する。

DailyとWeeklyの切り替えは既存Goalの換算ではなく、変更時点で新しい周期のGoal Revisionを追加する。

**Partial Birthday（部分誕生日）**:
Dogの誕生日を、Unknown、年のみ、年月、年月日のいずれかの精度で表した値。精度が不足する部分を推測して補完しない。
_Avoid_: Age（誕生日から算出した表示値）、Birthday Date（完全日付だけを意味する場合）

未来のPartial Birthdayは無効とする。

**Walk（散歩）**:
1回の散歩を表す記録。1頭以上の Participant、開始時刻、終了時刻、経路、メトリクス、任意の Event を持つ。
_Avoid_: Session、Trip、Activity

**Active Walk（進行中散歩）**:
Owner に対して同時に1件だけ存在できる、まだ完了していない Walk。画面遷移より優先され、履歴や貢献集計には含めない。
_Avoid_: Current Walk（曖昧）、Recording（Walk の状態名として使う）

Active Walkが存在するOwnerは新しいWalkを開始できず、既存Active Walkの状態（StartingまたはRecording）へ戻る。

Walk開始には、同じOwnerのDogを1頭以上選択し、foreground・background位置情報を許可し、既存のActive Walkがないことが必要。条件未達時は開始理由を表示して開始しない。

開始APIが失敗した場合はStartingからReadyへ戻し、偽のActive Walkや進捗を作らず、理由表示と手動再試行を許可する。

Finish APIが失敗した場合はRecordingを維持し、失敗を表示して手動再試行を許可する。成功時だけCompletedとしてWalk Detailへ遷移する。

アプリの強制終了・再起動時はAPI上のActive Walkを再照合する。API状態が`starting`ならWalk画面をStarting、`recording`ならRecordingとして復元する。存在しなければ端末ローカルだけのWalkは復元しない。

アプリがバックグラウンドに移行してもWalkは継続し、位置情報の取得・送信を停止しない。復帰時はAPI上のActive Walkを再照合する。

Walk中に位置情報許可が取り消され、位置情報を取得できなくなった場合はWalkをFailedとして破棄し、再認証へ進む。

バックグラウンド中の位置情報送信に失敗した場合は、一定期間または一定回数まで自動再送する。それでも復旧できなければWalkをFailedとして破棄する。再送の閾値は実装設定として定義する。

バックグラウンド送信中にAPIがActive Walkなしを返した場合は、端末側のWalkも即座にFailedとして破棄する。

位置情報の自動再送では取得時刻・位置・元の順序を保持する。送信成功後にだけ端末の保留分を削除する。

**Walk State（散歩状態）**:
Walk のライフサイクル上の状態。`Ready` は開始前、`Starting` は開始要求中、`Recording` は記録中、`Completed` は正常終了、`Failed` は再送・同期に失敗して終了した状態を表す。`Failed` の途中データは破棄し、履歴・Goal・Contributionには含めない。
_Avoid_: phase、status（文脈をまたぐ曖昧な総称）

**Track Point（経路点）**:
Walk 中に受け入れられた位置情報の点。有効な緯度・経度を持つものを経路・距離に採用する。位置情報の精度やGPSジャンプの良否は評価しない。
_Avoid_: Location（現在地や権限も含む広い語）

TrackPointは、認証済みAPIリクエストで、有効な緯度・経度を持つものだけ採用する。位置情報の精度やGPSジャンプの良否は評価しない。無効な緯度・経度は採用せず、距離計算にも使わない。

Walk Eventの手動再試行では、クライアント生成Event IDを冪等キーとしてAPIへ送信し、同じEventを二重登録しない。

Event APIはWalkがRecording状態のときだけ受け付ける。Ready、Starting、Completed、FailedのWalkに対するEventは拒否する。

同じEvent IDで種別・Participant・時刻・位置のいずれかが異なる再送が来た場合は、既存Eventを上書きせず競合エラーとして拒否する。

Event操作時にモバイル側で一意のEvent IDを生成する。送信失敗時はEventを記録せず、ユーザーに「記録に失敗しました」と表示する。手動再試行では最初と同じEvent ID・種別・Participant・操作時刻・位置を使う。同じID・同じ内容は冪等に成功させ、同じIDで内容が異なる場合は競合エラーとして拒否する。TrackPointにはEvent IDとは別のクライアント生成IDを追加しない。

Event APIは、指定されたParticipantが対象Walkに参加しているDogでない場合、Eventを拒否する。

Eventの発生時刻はAPI受信時刻ではなく、ユーザーが最初にEvent操作した時刻を採用し、手動再試行でも変更しない。

TrackPoint APIはWalkがRecording中の場合だけ受け付け、Ready、Starting、Completed、FailedのWalkでは拒否する。

TrackPointの取得・送信間隔は10秒固定とする。

10秒間隔で有効な緯度・経度を取得できない場合もWalkは継続し、次の有効なTrackPointを待つ。

**Walk Metric（散歩メトリクス）**:
Walk の distance、duration、pace の組。距離は単位設定に応じて表示するが、ドメイン上は単位に依存しない値として扱う。
_Avoid_: Stats（集計値と1回の散歩の値を混同する）

### 散歩中の出来事と履歴

**Event（散歩イベント）**:
特定の Walk と Participant に起きた出来事。`Pee`、`Poop`、`Sniff`、`Greet` を含み、発生時刻と位置を必ず持つ。
_Avoid_: Activity、Action、Log

Eventは必ず特定のParticipantに紐づく。複数犬Walkでも、どのDogの出来事かを識別できる。
有効な位置を取得できない場合はEventを記録しない。
送信失敗時は記録失敗を表示し、自動再送せず、同じEventの手動再試行だけを許可する。
手動再試行では、最初にEvent操作をした時点の発生時刻と位置を保持して送信する。


**Walk History（散歩履歴）**:
Completed Walk を時系列で閲覧する集合。Dog 詳細からは対象 Dog を含む Walk、Owner の履歴からは対象範囲に含まれる全 Dog の Walk を見る。
_Avoid_: Activity history、All walks（範囲が不明）

Walk履歴のDog名は保存時のsnapshotではなく、現在のDog名を表示する。
OwnerのWalk履歴では、管理する全Dogを対象にし、複数犬Walkは1件として表示する。
Dog詳細のWalk履歴では、そのDogがParticipantとして参加したWalkだけを表示する。

**Walk Detail（散歩詳細）**:
1件の Completed Walk の参加犬、メトリクス、経路、Eventを確認する読み取りモデル。
_Avoid_: Walk screen（Recording と混同する）

**Contribution（貢献）**:
Owner が完了した散歩から得る累計・週間の振り返り。Active Walk と失敗して破棄されたWalkは含めない。
_Avoid_: Statistics、Progress（Dog の Goal 達成度と混同する）

**Walker（散歩担当者）**:
Walk に記録される人の表示情報。Owner と一致する場合があるが、ドメイン上は別概念として扱う。
_Avoid_: Owner（常に同一とは限らない）

### 認証と設定

**Authentication Challenge（認証チャレンジ）**:
メールアドレスの所有を確認する一時的なOTP検証。OTPの桁数はCognitoのChallengeレスポンスに従い、アプリ側で固定しない。
_Avoid_: Password、Verification（目的が曖昧）

OTPを再送すると新しいOTPとSessionへ置き換わり、古いOTPとSessionは使用できない。

OTPの有効期限はCognitoの設定値を正とし、期限切れは`CODE_EXPIRED`として再送を案内する。

OTPの試行回数とrate limitはCognitoを正とし、バックエンド独自の制限は追加しない。制限到達時は`RATE_LIMITED`として扱う。

**Email Change（メールアドレス変更）**:
新しいメールアドレスを検証して Account の認証識別子を変更する操作。検証完了までは旧アドレスが有効で、完了後は全セッションを終了して新アドレスで再認証する。
_Avoid_: Account rename、Profile edit

メールアドレス変更成功後は全セッションを失効し、Sign Inへ戻って新しいメールアドレスで再認証する。

**Preference（設定値）**:
Owner が選ぶ言語、単位、外観、通知などの個人設定。単位設定は Walk、History、Detail、Contribution の表示に一貫して影響するべきである。
_Avoid_: Configuration、Option

GoalのDaily / Weekly集計はOwnerのタイムゾーンを基準にする。タイムゾーン未設定時は端末のタイムゾーンを使う。
Weekly Goalの週初めは月曜日とする。

## State transitions

### Walk lifecycle

```text
Ready --start intent--> Starting
Starting --authoritative start succeeds--> Recording
Starting --start fails--> Ready
Recording --finish succeeds--> Completed
    Recording --resend/sync failure--> Failed
Recording --recoverable temporary loss--> Recording
```

`Completed` は履歴・Goal・Contribution の対象になる。`Failed` は途中データを破棄して履歴・Goal・Contributionから除外する。`Starting`の表示だけでActive Walkや進捗を確定したことにはしない。

Walk履歴はCompletedのみを対象にし、開始日時の新しい順で表示する。Failedや進行中のActive Walkは履歴に表示しない。

履歴一覧は初回20件を取得し、下端到達時にoffset方式で次ページを追加読み込みする。

同じ開始日時のWalkが複数ある場合は、Walk IDの降順を第二ソートキーにする。

履歴とWalk Detailの日時はユーザーの端末タイムゾーンで表示し、APIのUTC日時をそのまま表示しない。

有効なTrackPointが1件もないままWalkを完了した場合もWalkはCompletedとして履歴に残し、距離は0として表示する。

Eventが1件もないCompleted Walkでは、Event欄を空状態（「記録されたEventはありません」）として表示する。

### Authentication lifecycle

```text
Unauthenticated --sign in / sign up--> Challenge pending
Challenge pending --valid OTP--> Authenticated
Challenge pending --invalid / expired / consumed / rate-limited--> Challenge recoverable
Authenticated --email change verified--> Unauthenticated (all sessions ended)
```

認証が失われた Active Walk では新しいEventの受付を止め、再認証・同期を試みる。同期できなければWalkを`Failed`として終了し、途中データを破棄する。

Access Tokenの更新にも失敗した場合は、新しい位置情報・Eventの送信を停止し、Active Walkを`Failed`として破棄してから再認証する。

Active Walk中のSign Outは確認ダイアログを表示する。承諾時はActive Walkを即座に`Failed`として破棄してSign Outし、キャンセル時はWalkとセッションを維持する。

## Boundary scenarios

- **Active Walk と別画面の競合**: Completed Walk の詳細を開こうとしても Active Walk があれば、そのActive Walkの状態（StartingまたはRecording）を優先する。詳細とWalk中画面の往復ループを作らない。
- **端末とサーバーの不一致**: 起動、サインイン、復帰時はサーバーの Active Walk を基準にする。端末だけに残る Walk を勝手に再開せず、サーバーに存在する Active Walk は端末状態がなくても復元する。
- **位置情報の中断**: foreground権限・サービスが失われる、または有効な位置が一定時間得られない場合は再送・同期を試みる。復旧できなければWalkを`Failed`として終了し、最後の有効なTrack Point以降を履歴に残さない。
- **開始・終了の再送**: 同じ開始・終了要求を連打しても、Active Walk や Completed Walk を二重作成しない。開始失敗は Ready に戻し、終了失敗は Recording を維持して再試行可能にする。
- **オフライン中の Event**: Pee、Poop、Sniff、Greetは位置情報が取得できていても送信できない場合は記録失敗とする。端末に保留して後から自動再送しない。
- **複数犬散歩**: 0頭では開始不可、1頭以上で開始可能。同名犬は ID で区別し、各 Event を正しい Participant に結び付ける。
- **空・失敗・未発見**: Dog 0件、取得中、取得失敗、Not Found、契約不整合は別の意味を持つ。失敗を空状態、未発見を無限 Loading として扱わない。
- API通信エラーは、初回取得時はエラー画面とRetryを表示する。既存データ表示中の更新失敗は既存データを保持したまま画面上部にエラーとRetryを表示する。
- APIがNot Foundを返した場合は通信エラーと分け、「見つかりません」画面を表示し、一覧画面へ戻る導線を提供する。
- APIレスポンスの必須フィールド欠落または型不正がある場合は部分表示せず、「データを読み込めません」とRetryを表示する。

受け入れ条件はGiven / When / Then形式で記述し、成功・失敗の両方についてテスト結果、スクリーンショット、APIレスポンスを証跡として残す。

テスト証跡の機密情報の保存方法は運用管理事項であり、外部仕様では定義しない。

E2Eの基本fixtureはOwner 2名、Owner1のDog 1頭、Owner2のDog 2頭、Completed Walk 2件、Active Walk 1件とする。Failed Walkや認証チャレンジ状態は各テストで追加生成する。

各E2Eケースに、対応する画面Route、APIエンドポイント、fixture、期待する証跡を必ず紐付ける。
- ログ・証跡への保存、アクセス、保持期間は運用管理事項であり、外部仕様では定義しない。
- Dynamic Typeに対応し、最大文字サイズでも文字切れを起こさず、必要な内容をスクロールで到達できるようにする。
- Reduce Motionが有効な端末では、画面遷移やアニメーションを簡略化または無効化する。
- **日時と単位**: 日付・Today/Yesterday・Event 時刻は端末のローカルタイムゾーンで解釈する。距離・ペースの表示は Preference の単位に追従し、保存値の単位と表示単位を混同しない。
- **Goal Revision**: Goal変更は過去のGoalや過去Walkの集計を書き換えず、新しい有効開始時刻を持つGoalを追加する。同じperiodとminutesを再送した場合は新しい履歴を増やさず冪等に扱う。
- **個人情報と証跡**: ログ・証跡への保存、アクセス、保持期間は運用管理事項であり、外部仕様では定義しない。

## Operational policy outside product scope

- サーバーログの保持期間はサーバー管理者が決める。
- サーバーログへアクセスできるのは管理者だけとする。
- Ownerからのログ開示請求には適用法令に従って対応する。

## Naming rules

- 通常の状態遷移では `Walk`、その状態では `Active Walk` / `Recording` を使う。`phase` や `session` は公開語にしない。
- ただし認証APIの外部フィールド`session`は、ユーザーが確定したCognito互換のopaque一時値として例外的に使用する。ドメイン用語やDB項目にはしない。
- 「履歴」「統計」「進捗」を混ぜず、Walk History、Contribution、Goal progress を使い分ける。
- Goalを変更するときは「Goal Revisionを追加する」と表現し、既存Goalを更新・上書きすると表現しない。
- UI の表示欠落や取得失敗をドメイン状態として「0件」と呼ばない。
