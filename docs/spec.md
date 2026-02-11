# ZLOSS代替（日程調整システム）GAS版 設計書 v3.0

## 1. プロジェクト概要

TimeRexの**API**、**カレンダーウィジェット**、**Webhook**を全て活用し、Google Apps Script (GAS) だけで稼働する日程調整システム。
Googleカレンダー連携を含め、自動予約・手動予約の双方に対応し、全ての予約データを一元管理する。

### 1.1 使用するTimeRex機能

- **TimeRex API**: 予約情報の取得、イベント操作（キャンセル等）
- **カレンダーウィジェット**: Webページへの埋め込みによる日程調整UI提供
- **Webhook**: 予約確定・キャンセル時のリアルタイム通知受信

### 1.2 システム構成

```
[LINE/Lステップ] 
  ↓ (URL配信: ボタンタップ時にWebhook転送でUID取得)
[ユーザー] 
  ↓ (日程調整)
[TimeRexウィジェット]
  ↓ (予約確定)
[TimeRex Webhook] → [GAS doPost] → [Google Spreadsheet]
                                    ↓
                              [Google Calendar]
                              (TimeRex標準連携)
                                    ↓
                              [LステップAPI]
                              (友だち情報更新・タグ設置)
                                    ↓
                              [LINE配信・リマインド設定]
```

## 2. 業務フロー (To-Be)

### 2.1 予約URLの送付 (自動予約)

**URL形式:**
```
.../exec?session_id={SESSION_ID}
.../exec?session_id={SESSION_ID}&interviewer_id={INTERVIEWER_ID}  // 特定面談官のカレンダーを表示
```

**重要:** URLにUIDを含めることはできません。UIDは **postback ボタン**のタップ時に送信されるLステップWebhook転送（POST）から取得します。

**処理フロー:**
1. Lステップから応募者に面談予約案内を配信（ステップ配信機能）
   - メッセージ内に postback ボタンを配置（例: `{"action":"booking","interviewer_id":"tanaka"}`）
   - ボタンタップでLステップが本システム（Webhook転送URL）へPOST ⇒ UIDと面談官IDを受信し `session_id` を発行（CacheService + `sessions` シート）
   - シナリオ側で応募者に「予約用URL（例: `...?action=lstep_webhook&interviewer_id=tanaka`）」をメッセージ送信
2. 応募者がメッセージ内のURLをクリック
   - `action=lstep_webhook` 付きGETを受信したGASは、直近2分以内に発行された `session_id` を面談官IDで検索し、予約画面用URL（`?session_id=...`）へリダイレクト
3. ユーザーがTimeRexで予約
   - `interviewer_id`パラメータなし: 統合カレンダー（複数名の空き時間）を表示
   - `interviewer_id`パラメータあり: その面談官の個別カレンダーを表示
4. Googleカレンダーに自動反映（TimeRex標準機能）
5. Webhookでスプレッドシートに記録
   - 複数の面談官が含まれる場合は、優先順位ロジックに基づいて自動アサイン
6. LステップAPI連携（自動実行）
   - 友だち情報更新（`meeting_date`, `meeting_url`, `meeting_cancel_url`）
   - タグ設置（`面談予約済み`）
7. Lステップ側でリマインド配信設定
   - 条件: `meeting_date` に値があること
   - 配信タイミング: 前日/当日
   - 配信内容: `{{meeting_url}}` と `{{meeting_cancel_url}}` を含む

### 2.2 手動登録 (代理登録)

電話やメールで日程が決まった場合、オペレーターはGASの「手動登録フォーム（または関数）」を実行する。

**処理フロー:**
1. GASが担当者のGoogleカレンダーに予定を作成
2. TimeRexがそれを「予定あり」と認識し、自動で枠をブロックする
3. 同時にスプレッドシートにも記録されるため、PORTERS連携用データに漏れが生じない

## 3. データベース設計 (Google Spreadsheet)

### 3.1 interviewers (設定マスタ)

面談官の設定情報を管理するシート。GoogleカレンダーID（メールアドレス）のカラムを追加。

| 列 | カラム名 | 説明 | 設定例 |
|---|---|---|---|
| A | `id` | 指名用ID | `tanaka` |
| B | `name` | 面談官名 | `田中 太郎` |
| C | `timerex_config_id` | 個別カレンダーのURLパス | `23a9cb5e`（手動設定） |
| D | `google_calendar_id` | 【追加】連携するカレンダーID | `tanaka@example.com` |
| E | `priority` | 【追加】アサイン優先順位 | `1`（低い数値ほど優先度が高い） |

**注意:**
- `timerex_config_id`は、その面談官が単独でメンバーとして含まれるTimeRexカレンダーの`calendar_url_path`を設定します
- 統合カレンダー（`TIMEREX_TEAM_CALENDAR_URL_PATH`）とは別のカレンダーとして、TimeRex側で作成する必要があります
- 基本的に手動設定を推奨します（管理画面の「同期」ボタンで自動マッチングを試みることも可能ですが、確実性を重視する場合は手動設定を行ってください）

### 3.2 interviews (予約台帳)

自動・手動問わず全ての予約が入る。

| 列 | カラム名 | 説明 | 例 | 備考 |
|---|---|---|---|---|
| A | `created_at` | 作成日時 | `2/1 10:00` | Webhookの`event.created_at` |
| B | `start_at` | 開始日時 | `2/5 10:00` | Webhookの`event.local_start_datetime` |
| C | `end_at` | 終了日時 | `2/5 11:00` | Webhookの`event.local_end_datetime` |
| D | `guest_name` | ゲスト名 | `山田` | Webhookの`event.form`から抽出 |
| E | `guest_email` | ゲストメールアドレス | `taro@...` | Webhookの`event.form`から抽出 |
| F | `meet_url` | ミーティングURL | `https://...` | Webhookの`event.zoom_meeting.join_url` |
| G | `line_uid` | LINEユーザーID | `U123` | Webhookの`event.url_params`から抽出 |
| H | `source` | 予約元 | `TimeRex` | `TimeRex` または `Manual` |
| I | `event_id` | 【推奨追加】TimeRexイベントID | `1981d18a994f60e7bcc2` | Webhookの`event.id`、キャンセル時の検索に使用 |
| J | `team_url_path` | 【推奨追加】チームURLパス | `mixtend_e6ed` | Webhookの`team_url_path` |
| K | `calendar_url_path` | 【推奨追加】カレンダーURLパス | `215aa110` | Webhookの`calendar_url_path` |
| L | `status` | 【推奨追加】予約ステータス | `1` | `1`:確定、`3`:キャンセル |
| M | `interviewer_id` | 【追加】面談官ID | `tanaka` | `interviewers.id`への外部キー |

**データ例:**

| created_at | start_at | end_at | guest_name | guest_email | meet_url | line_uid | source | event_id | status |
|---|---|---|---|---|---|---|---|---|---|
| 2/1 10:00 | 2/5 10:00 | 2/5 11:00 | 山田 | taro@... | https://... | U123 | TimeRex | 1981d18a... | 1 |
| 2/1 11:00 | 2/6 14:00 | 2/6 15:00 | 鈴木 | jiro@... | - | U456 | Manual | - | 1 |

**注意:**
- I列以降（`event_id`, `team_url_path`, `calendar_url_path`, `status`, `interviewer_id`）は推奨カラム。実装時に追加を検討。
- `event_id`があれば、キャンセル時のレコード検索が容易になる。
- `status`カラムにより、キャンセル済みの予約も記録として残せる。
- キャンセルURL（`event.guest_cancel_url`）はLステップAPIへの連携時に利用し、シートには保持していない。

### 3.3 sessions (UIDセッション管理)

LステップのWebhook転送で取得したUIDとセッションIDの対応を管理するシート。

| 列 | カラム名 | 説明 | 例 |
|---|---|---|---|
| A | `session_id` | セッションID（UUID） | `9d94a869-4206-495f-bafb-9f0dcd75cba2` |
| B | `uid` | LINEユーザーID | `U6e967fdb7...` |
| C | `name` | ユーザー名（取得できない場合は空） | `山田 花子` |
| D | `created_at` | 生成日時 | `2026-02-11 11:53:35` |
| E | `expires_at` | 有効期限（デフォルト10分後） | `2026-02-11 12:03:35` |
| F | `interviewer_id` | postbackデータで指定された面談官ID | `tanaka` |

**用途:**
- `handleLStepWebhook` が postback/Webhook転送を受信したタイミングで `session_id` を発行し、CacheServiceと併せて保存
- `handleBookingPage` が `session_id` から UID を逆引きし、TimeRexウィジェットの `url_params.line_uid` にセット
- 面談官指定付きURLの場合は `interviewer_id` で直近セッション（既定2分以内）を検索してリダイレクト先を決定

## 4. Google Calendar連携仕様

### 4.1 自動予約 (TimeRex → Google Calendar)

TimeRexの標準機能を使用。

TimeRex管理画面で、各担当者が自分のGoogleアカウントと連携設定を行うだけで完了。

### 4.2 手動予約 (GAS → Google Calendar)

GASの標準サービス `CalendarApp` を使用する。

**権限要件:**
- GASを実行するアカウント（管理者）が、各担当者のカレンダーに対する「変更権限」を持っている必要がある
- または担当者本人がGASを実行する

**処理手順:**
1. `interviewers` シートから対象者の `google_calendar_id` を取得
2. 以下のコードを実行：
   ```javascript
   CalendarApp.getCalendarById(id).createEvent(...)
   ```
3. これによりTimeRex側も「予定あり」となり、重複予約が防がれる

## 5. TimeRex API設計

本システムでは、TimeRex API、カレンダーウィジェット、Webhookを全て使用する。

### 5.1 認証

TimeRex APIは**APIキー認証**を使用する。

#### 5.1.1 APIキーの取得方法

1. TimeRexにログイン
2. ダッシュボード > チーム設定 > デベロッパーツール > TimeRex 日程調整API
3. APIキーを作成（64桁の半角英数字）

#### 5.1.2 APIキーの使用方法

リクエストヘッダーに `x-api-key` を設定して送信する。

```javascript
// GASでの実装例
const apiKey = PropertiesService.getScriptProperties().getProperty('TIMEREX_API_KEY');
const headers = {
  'x-api-key': apiKey,
  'Content-Type': 'application/json'
};

const response = UrlFetchApp.fetch('https://timerex.net/api/beta/user/me/teams', {
  method: 'get',
  headers: headers
});
```

**重要:** APIキーは `PropertiesService.getScriptProperties()` で管理し、コードに直接記載しない。

### 5.2 利用可能なAPIエンドポイント

APIキー認証で利用可能なエンドポイント一覧。

#### 5.2.1 チーム・ユーザー情報取得

| API名 | メソッド | エンドポイント | 用途 |
|-------|---------|---------------|------|
| Get User Primary Team | GET | `/api/beta/user/me/teams/primary` | APIキーを発行したチームを取得 |
| Get User Teams | GET | `/api/beta/user/me/teams` | APIキーを発行したチームのみを取得 |
| Get Team | GET | `/api/beta/teams/{team_id}` | チーム情報を取得（APIキーを発行したチームのみ） |

#### 5.2.2 カレンダー・イベント情報取得

| API名 | メソッド | エンドポイント | 用途 |
|-------|---------|---------------|------|
| Get Team Calendars | GET | `/api/beta/teams/{team_id}/calendars` | チームのカレンダー一覧を取得 |
| Get Calendar | GET | `/api/beta/calendars/{calendar_id}` | カレンダー情報を取得 |
| Get Calendar Events | GET | `/api/beta/calendars/{calendar_id}/events` | カレンダーの予定一覧を取得 |
| Get Event | GET | `/api/beta/events/{event_id}` | 予定詳細を取得 |

#### 5.2.3 ワンタイムURL管理

| API名 | メソッド | エンドポイント | 用途 |
|-------|---------|---------------|------|
| Get One time URL | GET | `/api/beta/calendars/one-time-url/{one_time_url_id}` | ワンタイムURL情報を取得 |
| Create One Time URL | POST | `/api/beta/calendars/{calendar_id}/one-time-url` | ワンタイムURLを生成 |
| Watch One Time URL | POST | `/api/beta/calendars/one-time-url/{one_time_url_id}/watch` | ワンタイムURLの変更を監視 |

#### 5.2.4 イベント操作

| API名 | メソッド | エンドポイント | 用途 |
|-------|---------|---------------|------|
| Cancel Event | POST | `/api/beta/events/{event_id}/cancel` | 予定をキャンセル |

#### 5.2.5 ページネーション

リスト取得APIはページネーションに対応。リクエストパラメータで制御可能。

#### 5.2.6 レート制限

APIリクエストにはレート制限が適用される。実装時は適切なリトライ処理を実装すること。

### 5.3 カレンダーウィジェット埋め込み

TimeRexのカレンダーウィジェットをWebページに埋め込むことで、ユーザーに日程調整を提供する。

#### 5.3.1 基本埋め込みコード

```html
<!-- Begin TimeRex Widget -->
<div id="timerex_calendar" data-url="https://timerex.net/s/{team_url_path}/{calendar_url_path}"></div>
<script id="timerex_embed" src="https://asset.timerex.net/js/embed.js"></script>
<script type="text/javascript">
  TimerexCalendar({});
</script>
<!-- End TimeRex Widget -->
```

#### 5.3.2 データ統合（自動入力）

予約フォームの項目（名前、メールアドレス等）を自動入力可能。

```javascript
TimerexCalendar({
  'guest_company': 'Mixtend Inc.',
  'guest_name': 'Tomohiro Kitano',
  'guest_email': 'guest@example.com',
  'guest_comment': 'Hello',
  'locale': 'ja'  // 'ja' or 'en'
});
```

#### 5.3.3 パラメータ統合（URL Parameters）

URLパラメータとして最大25個まで追加情報を渡せる。Webhookで受信可能。

```javascript
TimerexCalendar({
  'url_params': {
    'user_hash': 'abcdefg1234567',
    'campaign_id': 'Osaka_SMB',
    'line_uid': 'U1234567890'  // LINEユーザーIDを渡す
  }
});
```

**本システムでの活用:**
- `line_uid`: LINEユーザーIDを渡し、Webhook受信時に `interviews` シートの `line_uid` カラムに記録

#### 5.3.4 カスタマイズオプション（Premium版）

- `primary_color`: ウィジェットのキーカラー（カラーコード指定）
- `disable_logo`: TimeRexロゴの非表示（`true`/`false`）
- `disable_title_hyperlink`: カレンダー名のハイパーリンク無効化（`true`/`false`）

#### 5.3.5 コールバック機能

ウィジェットのライフサイクルイベントを監視可能。

```javascript
TimerexCalendar({
  'onLoad': function() {
    console.log('Widget Loaded');
  },
  'onFormOpen': function() {
    console.log('Booking form opened');
  },
  'onBookingComplete': function() {
    console.log('Booking completed');
    // 予約完了後の処理（例: リダイレクト、トラッキング等）
    // window.location.href = 'https://example.com/thanks';
  }
});
```

#### 5.3.6 GAS Webアプリでの活用

GASのHTMLサービスでウィジェットを埋め込む場合：

```javascript
// Code.gs
function doGet(e) {
  // 注意: URLパラメータからUIDを取得することはできません
  // UIDはボタンタップ時のWebhook転送経由で取得し、セッションID経由で受け渡します
  let uid = '';
  const sessionId = e.parameter.session_id;
  if (sessionId) {
    // uidlogシートからUIDを取得（カラム: 日時, uid, sessionid, イベント種別）
    uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId) || '';
  }
  
  const template = HtmlService.createTemplateFromFile('Widget');
  template.uid = uid;
  template.calendarUrl = 'https://timerex.net/s/{team}/{calendar}';
  return template.evaluate();
}
```

```html
<!-- Widget.html -->
<!DOCTYPE html>
<html>
<body>
  <div id="timerex_calendar" data-url="<?= calendarUrl ?>"></div>
  <script id="timerex_embed" src="https://asset.timerex.net/js/embed.js"></script>
  <script type="text/javascript">
    TimerexCalendar({
      'url_params': {
        'line_uid': '<?= uid ?>'
      },
      'onBookingComplete': function() {
        google.script.host.close();
      }
    });
  </script>
</body>
</html>
```

### 5.4 Webhook仕様

TimeRexから予約確定・キャンセル時にWebhookが送信される。

#### 5.4.1 Webhook設定

**設定場所:**
- TimeRex管理画面 > チーム設定 > Integrations

**要件:**
- HTTPS URLのみ対応（SSL証明書必須、自己署名証明書不可）
- ポート443のみ対応
- localhost URLは不可
- IPアドレスは不可

**GAS Webhookエンドポイント:**
```
https://script.google.com/macros/s/{SCRIPT_ID}/exec
```

**セキュリティトークン:**
- Webhook設定時にセキュリティトークンが生成される
- リクエストヘッダーの `x-timerex-authorization` で検証必須
- トークンが一致しない場合はリクエストを破棄

#### 5.4.2 Webhookリクエスト形式

**メソッド:** POST

**ヘッダー:**
```
Content-Type: application/json
Accept: application/json
User-Agent: TimeRex API v<api-version>
x-timerex-authorization: <your-security-token>
```

**カスタムヘッダー:**
- 最大10個まで追加可能
- ヘッダー名は小文字に変換される

#### 5.4.3 イベントタイプ

| イベントタイプ | 説明 |
|---------------|------|
| `event_confirmed` | 予約が確定した時 |
| `event_cancelled` | 予約がキャンセルされた時 |

#### 5.4.4 イベント確定（event_confirmed）

**ペイロード例:**
```json
{
  "webhook_type": "event_confirmed",
  "calendar_url_path": "215aa110",
  "team_url_path": "mixtend_e6ed",
  "calendar_url": "https://timerex.net/s/mixtend_e6ed/215aa110",
  "calendar_name": "sample",
  "event": {
    "id": "1981d18a994f60e7bcc2",
    "status": 1,
    "duration": 60,
    "start_datetime": "2020-08-26T09:00:00+00:00",
    "end_datetime": "2020-08-26T10:00:00+00:00",
    "local_start_datetime": "2020-08-26T18:00:00+09:00",
    "local_end_datetime": "2020-08-26T19:00:00+09:00",
    "calendar_timezone": "Asia/Tokyo",
    "guest_locale": "ja",
    "created_at": "2020-08-20T02:22:40+00:00",
    "host_cancel_url": "https://timerex.net/schedule/host_cancel/1981d18a994f60e7bcc2",
    "guest_cancel_url": "https://timerex.net/schedule/cancel/1981d18a994f60e7bcc2",
    "guest_reschedule_url": "https://timerex.net/schedule/change/1981d18a994f60e7bcc2",
    "online_meeting_provider": "zoom",
    "zoom_meeting": {
      "meeting_id": 83736482957,
      "join_url": "https://us02web.zoom.us/j/83736482957?pwd=...",
      "password": "035211",
      "host": {
        "name": "Mixtend Demo",
        "email": "demo@mixtend.com"
      }
    },
    "hosts": [
      {
        "name": "Mixtend Demo",
        "email": "demo@mixtend.com"
      }
    ],
    "form": [
      {
        "field_type": "guest_name",
        "required": true,
        "label": "名前",
        "value": "Tomohiro Kitano"
      },
      {
        "field_type": "guest_email",
        "required": true,
        "label": "メールアドレス",
        "value": "guest@mixtend.com"
      }
    ],
    "url_params": [
      {
        "line_uid": "U1234567890"
      },
      {
        "utm_source": "example"
      }
    ]
  }
}
```

**主要フィールド:**
- `event.id`: イベントID（予約ID）
- `event.start_datetime`: 開始日時（UTC、ISO8601形式）
- `event.end_datetime`: 終了日時（UTC、ISO8601形式）
- `event.local_start_datetime`: 開始日時（ローカルタイムゾーン）
- `event.local_end_datetime`: 終了日時（ローカルタイムゾーン）
- `event.form`: フォーム入力値の配列
- `event.url_params`: URLパラメータの配列（ウィジェットで渡した値）
- `event.zoom_meeting`: Zoomミーティング情報（設定されている場合）
- `event.guest_cancel_url`: ゲスト用キャンセルURL（LINE配信でのキャンセルに使用）
- `event.guest_reschedule_url`: ゲスト用リスケジュールURL
- `event.host_cancel_url`: ホスト用キャンセルURL

#### 5.4.5 イベントキャンセル（event_cancelled）

**ペイロード例:**
```json
{
  "webhook_type": "event_cancelled",
  "calendar_url_path": "215aa110",
  "team_url_path": "mixtend_e6ed",
  "calendar_url": "https://timerex.net/s/mixtend_e6ed/215aa110",
  "calendar_name": "sample",
  "event": {
    "id": "1981d18a994f60e7bcc2",
    "status": 3,
    "canceled_at": "2020-08-20T02:24:27+00:00",
    "cancellation_reason": "i want to cancel",
    "start_datetime": "2020-08-26T09:00:00+00:00",
    "end_datetime": "2020-08-26T10:00:00+00:00",
    // ... その他フィールドは event_confirmed と同様
  }
}
```

**主要フィールド:**
- `event.status`: 3（キャンセル済み）
- `event.canceled_at`: キャンセル日時
- `event.cancellation_reason`: キャンセル理由

#### 5.4.6 GASでのWebhook受信実装

```javascript
// Code.gs
function doPost(e) {
  try {
    // セキュリティトークンの検証
    const securityToken = PropertiesService.getScriptProperties().getProperty('TIMEREX_WEBHOOK_TOKEN');
    const receivedToken = e.parameter['x-timerex-authorization'] || 
                         (e.postData && JSON.parse(e.postData.contents)['x-timerex-authorization']);
    
    if (receivedToken !== securityToken) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'Unauthorized'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ペイロードの取得
    const payload = JSON.parse(e.postData.contents);
    
    // イベントタイプによる分岐
    if (payload.webhook_type === 'event_confirmed') {
      handleEventConfirmed(payload);
    } else if (payload.webhook_type === 'event_cancelled') {
      handleEventCancelled(payload);
    }
    
    // 成功レスポンス（200を返すこと）
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // エラーログ記録
    Logger.log('Webhook error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleEventConfirmed(payload) {
  const event = payload.event;
  
  // form配列から必要な情報を抽出
  const guestName = event.form.find(f => f.field_type === 'guest_name')?.value || '';
  const guestEmail = event.form.find(f => f.field_type === 'guest_email')?.value || '';
  
  // url_paramsからLINEユーザーIDを取得
  const lineUid = event.url_params?.find(p => p.line_uid)?.line_uid || '';
  
  // ミーティングURL（Zoom、Google Meet、Microsoft Teamsに対応）
  let meetUrl = '';
  if (event.zoom_meeting?.join_url) {
    meetUrl = event.zoom_meeting.join_url;
  } else if (event.google_meet_meeting?.join_url) {
    meetUrl = event.google_meet_meeting.join_url;
  } else if (event.microsoft_teams_meeting?.join_url) {
    meetUrl = event.microsoft_teams_meeting.join_url;
  }
  
  // キャンセルURL（LINE配信でのキャンセルに使用）
  const guestCancelUrl = event.guest_cancel_url || '';
  
  // 面談官の特定（優先順位ロジック）
  let interviewerId = '';
  if (event.hosts && event.hosts.length > 0) {
    const allInterviewers = getAllInterviewers(true); // 優先順位でソート
    const hostEmails = event.hosts.map(h => h.email);
    
    // 優先順位順に面談官を検索
    for (const interviewer of allInterviewers) {
      if (hostEmails.some(email => 
        email.toLowerCase() === interviewer.googleCalendarId.toLowerCase()
      )) {
        interviewerId = interviewer.id;
        break; // 最優先の面談官にアサイン
      }
    }
  }
  
  // interviewsシートに記録
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('interviews');
  
  const row = [
    new Date(),  // created_at
    new Date(event.local_start_datetime),  // start_at
    new Date(event.local_end_datetime),    // end_at
    guestName,   // guest_name
    guestEmail,  // guest_email
    meetUrl,     // meet_url
    lineUid,     // line_uid
    'TimeRex',   // source
    event.id,    // event_id
    payload.team_url_path,      // team_url_path
    payload.calendar_url_path, // calendar_url_path
    1,           // status (確定)
    interviewerId // interviewer_id
  ];
  
  sheet.appendRow(row);
  
  // LステップAPI連携（LINE UIDがある場合）
  if (lineUid) {
    try {
      // 日時をLステップ形式にフォーマット
      const meetingDate = LStepApiService.formatDateTimeForLStep(new Date(event.local_start_datetime));
      
      // 友だち情報を更新
      LStepApiService.updateFriendInfo(lineUid, {
        meeting_date: meetingDate,
        meeting_url: meetUrl || null,
        meeting_cancel_url: guestCancelUrl || null
      });
      
      // タグを設置
      const tagName = Config.LSTEP_TAG_NAMES.BOOKING_CONFIRMED;
      LStepApiService.addTag(lineUid, tagName);
    } catch (lstepError) {
      Logger.log(`LステップAPI連携エラー（無視）: ${lstepError.toString()}`);
      // LステップAPI連携失敗は予約処理を止めない
    }
  }
}

function handleEventCancelled(payload) {
  const event = payload.event;
  const eventId = event.id;
  
  // interviewsシートから該当レコードを検索
  const interview = SpreadsheetService.findInterviewByEventId(eventId);
  if (!interview) {
    Logger.log(`Interview not found for event_id: ${eventId}`);
    return;
  }
  
  // ステータスをキャンセル（3）に更新
  SpreadsheetService.updateInterviewStatus(interview.rowIndex, Config.EVENT_STATUS.CANCELLED);
  
  // LステップAPI連携（LINE UIDがある場合）
  const lineUid = interview.data?.lineUid;
  if (lineUid) {
    try {
      // 友だち情報をクリア（リマインド配信停止）
      LStepApiService.updateFriendInfo(lineUid, {
        meeting_date: null,
        meeting_url: null,
        meeting_cancel_url: null
      });
    } catch (lstepError) {
      Logger.log(`LステップAPI連携エラー（キャンセル、無視）: ${lstepError.toString()}`);
      // LステップAPI連携失敗はキャンセル処理を止めない
    }
  }
}
```

#### 5.4.7 Webhookレスポンス要件

- **成功時:** HTTP 200を返す（15秒以内）
- **失敗時:** HTTP 400/500を返すと再試行される
- **再試行:** 失敗時は10秒間隔で最大3回まで再試行

#### 5.4.8 データ処理フロー

```
TimeRex予約確定/キャンセル
  ↓
Webhook送信（POST）
  ↓
GAS doPost受信
  ↓
セキュリティトークン検証
  ↓
ペイロード解析
  ↓
データ検証・正規化
  ↓
interviewsシートに記録/更新
  ↓
LステップAPI連携（予約確定時のみ）
  - LINE UID抽出（event.url_paramsから）
  - 友だち情報更新（meeting_date, meeting_url, meeting_cancel_url）
  - タグ設置（面談予約済み）
  ↓
HTTP 200返却
```

**キャンセル時の処理フロー:**
```
TimeRex予約キャンセル
  ↓
Webhook送信（POST、event_cancelled）
  ↓
GAS doPost受信
  ↓
セキュリティトークン検証
  ↓
ペイロード解析
  ↓
interviewsシートのステータス更新（3: キャンセル）
  ↓
LステップAPI連携（LINE UIDがある場合）
  - 友だち情報クリア（meeting_date=null, meeting_url=null, meeting_cancel_url=null）
  - リマインド配信停止（条件: meeting_dateが空）
  ↓
HTTP 200返却
```

#### 5.4.9 データマッピング

Webhookペイロードから `interviews` シートへのマッピング:

| interviewsカラム | Webhookデータソース |
|-----------------|-------------------|
| `created_at` | `event.created_at` |
| `start_at` | `event.local_start_datetime` |
| `end_at` | `event.local_end_datetime` |
| `guest_name` | `event.form`（`field_type: "guest_name"`の`value`） |
| `guest_email` | `event.form`（`field_type: "guest_email"`の`value`） |
| `meet_url` | `event.zoom_meeting.join_url` または `event.google_meet_meeting.join_url` または `event.microsoft_teams_meeting.join_url` |
| `line_uid` | `event.url_params`（`line_uid`キーの値） |
| `source` | `"TimeRex"`（固定値） |
| `event_id` | `event.id` |
| `team_url_path` | `payload.team_url_path` |
| `calendar_url_path` | `payload.calendar_url_path` |
| `status` | `1`（確定時）または `3`（キャンセル時） |
| `interviewer_id` | `event.hosts`から優先順位ロジックで決定 |
| `meeting_cancel_url` | `event.guest_cancel_url` |
| `calendar_url_path` | `payload.calendar_url_path` |
| `status` | `1`（確定）または `3`（キャンセル） |
| `interviewer_id` | `event.hosts`から優先順位ロジックで決定 |

## 6. エラーハンドリング

### 6.1 TimeRex APIエラー

**エラーケース:**
- APIキーが無効
- レート制限超過
- ネットワークエラー
- 存在しないリソースへのアクセス

**対応:**
- try-catchでエラーを捕捉
- 指数バックオフによるリトライ処理
- エラーログをスプレッドシートまたはログシートに記録
- APIキーの再取得が必要な場合は適切なエラーメッセージを表示

### 6.2 Webhook受信エラー

**エラーケース:**
- セキュリティトークンの不一致
- ペイロードの形式不正
- タイムアウト（15秒超過）

**対応:**
- セキュリティトークンの検証を最初に実施
- ペイロードのスキーマ検証（必須フィールドの存在確認）
- エラー時は適切なHTTPステータスコードを返す
- エラーログにペイロード全体を記録（機密情報は除外）

### 6.3 カレンダー連携エラー

**エラーケース:**
- カレンダーIDが存在しない
- 権限不足
- カレンダー作成APIのレート制限

**対応:**
- try-catchでエラーを捕捉
- エラーログをスプレッドシートまたはログシートに記録
- ユーザーに適切なエラーメッセージを返す

### 6.4 スプレッドシートエラー

**エラーケース:**
- シートが存在しない
- 書き込み権限不足
- データ形式エラー

**対応:**
- データ検証を実施（Zod等のスキーマ検証を推奨）
- エラー発生時はロールバックを検討
- エラー詳細をログに記録

## 7. セキュリティ考慮事項

### 7.1 認証・認可

- **APIキー管理:** `PropertiesService.getScriptProperties()` で管理、コードに直接記載しない
- **Webhook検証:** セキュリティトークン（`x-timerex-authorization`）を必ず検証
- **スプレッドシート権限:** アクセス権限を最小限に設定

### 7.2 データ保護

- 個人情報（メールアドレス、LINE ID等）の取り扱いに注意
- スプレッドシートの共有設定を適切に管理
- ログに機密情報を含めない

### 7.3 入力検証

- Webhookのペイロードを必ず検証
- スプレッドシートへの書き込み前にデータ形式を確認
- SQLインジェクション対策（GASでは基本的に不要だが、文字列操作時は注意）

### 7.4 HTTPS通信

- WebhookエンドポイントはHTTPSのみ対応
- SSL証明書の検証を確実に実施

## 8. 画面設計

本システムは2つの主要画面で構成される。

### 8.1 予約画面（候補者向け）

**URL:** `https://script.google.com/macros/s/{SCRIPT_ID}/exec?session_id={SESSION_ID}`
**注意:** URLにUIDを含めることはできません。セッションID経由でUIDを取得します。

**目的:** LINE経由で受け取ったURLから、候補者が面談日程を予約する。

#### 8.1.1 画面構成

| 要素 | 説明 | 実装方法 |
|------|------|---------|
| **ヘッダー** | ロゴ、タイトル、お問い合わせボタン | 固定ヘッダー（sticky） |
| **ウェルカムカード** | ユーザー名表示、アイコン、案内文 | Vue.jsで動的表示 |
| **カレンダーエリア** | TimeRexウィジェット埋め込み | iframeでTimeRexウィジェットを表示 |
| **ローディング表示** | ウィジェット読み込み中のスケルトンUI | Vue.js transition |
| **フッター** | トラブルシューティングリンク | 静的テキスト |

#### 8.1.2 主要機能

##### 8.1.2.1 ユーザー情報表示

- **表示内容:**
  - ユーザー名（LINEユーザー名）
  - ユーザーアイコン（LINEプロフィール画像、取得可能な場合）
- **データソース:** ボタンタップ時のWebhook転送経由で取得したUIDを使用して、GASでLINE APIから取得（またはスプレッドシートから取得）

##### 8.1.2.2 TimeRexウィジェット埋め込み

- **実装方式:** iframeでTimeRexカレンダーウィジェットを埋め込み
- **URL構築:**
  - `interviewer_id`パラメータなし:
    ```
    https://timerex.net/s/{team_url_path}/{team_calendar_url_path}
    ```
    - 統合カレンダー（複数名の空き時間を表示）を使用
    - `TIMEREX_TEAM_CALENDAR_URL_PATH`（PropertiesService）から取得
    - 設定が未完了の場合はエラーメッセージを表示
  - `interviewer_id`パラメータあり:
    ```
    https://timerex.net/s/{team_url_path}/{interviewer_timerex_config_id}
    ```
    - その面談官の個別カレンダーを使用
    - `interviewers`シートから該当面談官を取得し、`timerex_config_id`を使用
    - 面談官が見つからない場合、または`timerex_config_id`が未設定の場合はエラーメッセージを表示
- **パラメータ渡し:**
  - `guest_name`: ユーザー名
  - `guest_email`: ユーザーメールアドレス（取得可能な場合）
  - `url_params.line_uid`: LINEユーザーID（Webhookで受信するため）
- **エラーハンドリング:**
  - 面談官が見つからない場合: 「面談官ID（{id}）が見つかりません。」
  - TimeRex設定が未完了の場合: 「面談官（{name}）のTimeRex設定が完了していません。」
  - 統合カレンダー設定が未完了の場合: 「統合カレンダーの設定が完了していません。」
  - エラー時はエラーメッセージを表示し、TimeRexウィジェットは表示しない

##### 8.1.2.3 ローディング状態管理

- **初期表示:** スケルトンUI（カレンダー風のローディングアニメーション）
- **読み込み完了:** iframeの`onload`イベントで非表示に切り替え
- **表示時間:** 最低2秒（UX向上のため）

##### 8.1.2.4 担当者情報表示

- **表示位置:** カレンダーエリアのヘッダー
- **表示内容:** 固定テキスト「採用担当チーム」
- **備考:** 実際の予約先はTimeRex側の設定で決定されるため、表示は固定テキストとする

##### 8.1.2.5 お問い合わせ機能

- **ボタン配置:** ヘッダー右側
- **機能:** クリックでLINEに戻る、または問い合わせフォームを表示
- **実装:** 
  - LINEボットからの遷移の場合: `LINE://` スキームでLINEアプリを開く
  - それ以外: 問い合わせ先URLにリダイレクト（設定可能）

##### 8.1.2.6 トラブルシューティング

- **表示位置:** 画面下部
- **機能:** カレンダーが表示されない場合の対処法を案内
- **リンク:** 「ブラウザで開く」リンク（新しいタブで開く）

#### 8.1.3 データフロー

```
1. ユーザーが postback ボタンをタップ → Webhook転送（POST）でUID取得 → `session_id`生成（CacheService + `sessions`）
   ↓
2. Lステップが応募者に予約URLをメッセージ送信 → ユーザーがURLを開く（`?action=lstep_webhook&interviewer_id=...`）
   ↓
3. GAS doGet() が `interviewer_id` をキーに直近（2分以内）の `session_id` を検索し、`?session_id=...` へリダイレクト
   ↓
4. `session_id` から CacheService / `sessions` シートを参照して UID を取得
   ↓
5. interviewer_idの有無を確認
   ↓
6a. interviewer_idあり:
   - interviewersシートから該当面談官を取得
   - timerex_config_idを取得
   - エラーチェック（面談官が見つからない、設定未完了）
   ↓
6b. interviewer_idなし:
   - PropertiesServiceからTIMEREX_TEAM_CALENDAR_URL_PATHを取得
   - エラーチェック（設定未完了）
   ↓
7. LINE API / スプレッドシートからユーザー情報を取得（UIDを使用）
   ↓
8. HTMLテンプレートにデータを埋め込み（<?= JSON.stringify(data) ?>）
   ↓
9. ブラウザでHTMLを表示
   ↓
10. エラーがない場合、Vue.jsがTimeRexウィジェットのURLを構築
    - url_paramsにline_uidを設定（取得したUIDを使用）
    ↓
11. iframeでTimeRexウィジェットを読み込み
    ↓
12. ユーザーが予約を確定
    ↓
13. TimeRexからWebhookが送信される
```

#### 8.1.4 UI/UX要件

- **レスポンシブデザイン:** モバイルファースト、最大幅2xl（672px）
- **カラー:** 緑系（`green-500`, `green-600`）をアクセントカラーとして使用
- **フォント:** Noto Sans JP（日本語対応）
- **アイコン:** Phosphor Icons
- **アニメーション:** フェードイン/アウト（Vue.js transition）

#### 8.1.5 エラーハンドリング

- **ユーザー情報取得失敗:** デフォルト値（「ゲスト様」等）を表示
- **面談官が見つからない場合:** エラーメッセージを表示し、TimeRexウィジェットは表示しない
- **TimeRex設定が未完了の場合:** エラーメッセージを表示し、TimeRexウィジェットは表示しない
- **統合カレンダー設定が未完了の場合:** エラーメッセージを表示し、TimeRexウィジェットは表示しない
- **TimeRexウィジェット読み込み失敗:** エラーメッセージと「ブラウザで開く」リンクを表示
- **iframe読み込みタイムアウト:** 10秒でタイムアウト、再試行ボタンを表示

### 8.2 管理画面（面談官向け）

**URL:** `https://script.google.com/macros/s/{SCRIPT_ID}/exec?page=admin&interviewer_id={INTERVIEWER_ID}`

**目的:** 面談官が自分の予約スケジュールを確認・管理する。

#### 8.2.1 画面構成

| 要素 | 説明 | 実装方法 |
|------|------|---------|
| **ヘッダー** | ロゴ、フィルタリング、電話予約登録ボタン、ユーザープロフィール | 固定ヘッダー |
| **サイドバー** | 統計情報、直近の予約リスト | レスポンシブ（デスクトップのみ表示） |
| **メインカレンダー** | FullCalendarによる予定表示 | FullCalendar 6.1.10 |
| **イベント詳細モーダル** | クリックした予定の詳細表示 | Vue.js transition modal |
| **ローディングオーバーレイ** | データ取得中の表示 | Vue.js transition |

#### 8.2.2 主要機能

##### 8.2.2.1 アサイン優先順位設定機能

- **表示位置:** サイドバーの統計情報の上
- **表示内容:**
  - タイトル: 「アサイン優先順位」
  - 面談官名を優先順位順に横並びで表示（例：川島 > 尾座本 > 川崎）
  - 「設定」ボタン
- **設定モーダル:**
  - 各面談官の優先順位を数値で入力（低い数値ほど優先度が高い）
  - 一括保存機能
  - 優先順位が同じ場合は登録順（行番号）で決定
- **データ保存:** `interviewers`シートの`priority`カラム（E列）に保存
- **用途:** Webhook受信時に複数の面談官が含まれる場合、優先順位に基づいて自動アサイン

##### 8.2.2.2 フィルタリング機能

- **フィルタオプション:**
  - `me`: 自分の予定のみ（自分の面談予約 + 自分のGoogleカレンダー予定）
  - `all`: チーム全員の予約
  - `{interviewer_id}`: 特定の面談官の予約のみ
- **実装:** プルダウンメニューで選択、カレンダーを再描画

##### 8.2.2.3 統計情報表示

- **表示位置:** サイドバーの上部
- **表示内容:**
  - **今日の面談数:** 本日の`start_at`が今日の予約をカウント（緑背景）
  - **今週の合計面談数:** 今週（月曜日〜日曜日）の予約をカウント（青背景）
- **データソース:** `interviews`シートから集計
- **集計条件:**
  - `source='TimeRex'` または `source='Manual'`
  - `status=1`（確定のみ、キャンセル除外）
  - フィルタが`me`の場合は、該当面談官（`interviewer_id`）の予約のみ
- **更新タイミング:** ページ読み込み時、カレンダー更新時

##### 8.2.2.4 予約リスト（サイドバー）

- **表示内容:**
  - 自分の直近の予約（時間順）
  - 各予約: 日時、候補者名、担当面談官名
- **インタラクション:** クリックでカレンダーの該当日時にジャンプ、詳細モーダルを表示

##### 8.2.2.5 カレンダー表示

- **ライブラリ:** FullCalendar 6.1.10
- **表示モード:**
  - 月表示（`dayGridMonth`）
  - 週表示（`timeGridWeek`）- デフォルト
- **表示時間:** 09:00〜20:00
- **イベントタイプ:**
  - **面談予約（緑）:** `interviews`シートから取得、`source='TimeRex'`
  - **他メンバーの予約（青）:** フィルタが`all`の時のみ表示
  - **Googleカレンダー予定（グレー）:** Google Calendar APIから取得
- **インタラクション:**
  - **クリック:** イベント詳細モーダルを表示
  - **範囲選択:** 時間ブロック作成（手動予約登録用）

##### 8.2.2.6 イベント詳細モーダル

- **表示内容:**
  - **基本情報:**
    - 予定タイトル（例: 「面談: 山田 花子様」）
    - 日時（開始・終了）
    - ステータスバッジ（面談予約 / Googleカレンダー）
  - **面談予約の場合:**
    - 候補者メールアドレス
    - 担当面談官名
    - Google Meet参加リンク（`meet_url`）
  - **Googleカレンダー予定の場合:**
    - 「Googleカレンダーで確認」メッセージのみ
- **アクション:**
  - Google Meet参加ボタン（面談予約の場合のみ）
  - モーダル閉じるボタン

##### 8.2.2.7 電話予約登録機能

- **ボタン配置:** ヘッダー右側
- **機能:** クリックで手動予約登録フォーム（モーダルまたは別画面）を開く
- **実装:** GAS関数 `registerManualBooking()` を呼び出し

##### 8.2.2.8 時間ブロック機能

- **機能:** カレンダーで範囲選択すると、その時間をブロック（予約不可にする）
- **操作方法:** FullCalendarの`selectable: true`により、カレンダー上でドラッグして範囲選択
- **確認ダイアログ:** 選択後に確認ダイアログを表示
  ```
  「{日時} から {時刻} をブロックしますか？
  (TimeRexで予約不可になります)」
  ```
- **実装:** 
  1. Google Calendar APIで該当面談官のカレンダーに予定を作成（タイトル: 「【ブロック】面談不可」）
  2. TimeRexがGoogleカレンダーの予定を認識し、自動でその時間をブロック
  3. カレンダーを再描画（`calendarApi.refetchEvents()`）
- **表示:** ブロック時間は赤色（`red-500`）で表示

#### 8.2.3 データフロー

```
1. 面談官が管理画面にアクセス
   ↓
2. GAS doGet() でinterviewer_idを取得
   ↓
3. interviewsシートから予約データを取得
   ↓
4. Google Calendar APIから該当面談官の予定を取得
   ↓
5. データを統合・整形してJSONで返却
   ↓
6. ブラウザでFullCalendarに描画
   ↓
7. フィルタ変更時はクライアント側で再フィルタリング
   ↓
8. イベントクリック時はモーダルで詳細表示
```

#### 8.2.4 UI/UX要件

- **レイアウト:**
  - ヘッダー: 固定、高さ64px
  - サイドバー: 幅320px（デスクトップのみ）、スクロール可能
  - メインカレンダー: 残りの領域を使用
- **カラー:**
  - 面談予約: 緑（`green-500`）
  - 他メンバー: 青（`blue-500`）
  - Googleカレンダー: グレー（`gray-400`）
  - ブロック時間: 赤（`red-500`）
- **フォント:** Inter + Noto Sans JP
- **アイコン:** Phosphor Icons
- **アニメーション:** フェードイン/アウト（モーダル、ローディング）
- **凡例:** カレンダー右上に表示（画面幅に応じて非表示可）

#### 8.2.5 データ取得最適化

- **初期表示:** 当月 + 前後1ヶ月分のデータを取得
- **カレンダー移動時:** 必要に応じて追加データを取得（FullCalendarの`events`関数で動的取得）
- **キャッシュ:** クライアント側（Vue.jsのref）でデータを保持、不要な再取得を防止

### 8.3 手動予約登録フォーム（管理画面サブ機能）

**目的:** 電話やメールで決まった日程を手動で登録する。

#### 8.3.1 画面構成（想定）

- **モーダルまたは別画面**
- **入力項目:**
  - 候補者名（必須）
  - 候補者メールアドレス（必須）
  - 開始日時（必須）
  - 終了日時（必須）
  - 担当面談官（必須、プルダウン）
  - メモ・備考（任意）

#### 8.3.2 処理フロー

```
1. フォーム送信
   ↓
2. GAS関数 registerManualBooking() を呼び出し
   ↓
3. Google Calendar APIで該当面談官のカレンダーに予定を作成
   ↓
4. interviewsシートに記録（source='Manual'）
   ↓
5. 成功メッセージ表示、カレンダーを更新
```

### 8.4 技術スタック

#### 8.4.1 フロントエンド

- **フレームワーク:** Vue.js 3（CDN経由）
- **スタイリング:** Tailwind CSS（CDN経由）
- **アイコン:** Phosphor Icons
- **カレンダー:** FullCalendar 6.1.10（管理画面のみ）
- **状態管理:** Vue.js Composition API（ref, computed）

#### 8.4.2 バックエンド（GAS）

- **HTML Service:** `HtmlService.createTemplateFromFile()`
- **データ取得:** `SpreadsheetApp`, `CalendarApp`, `UrlFetchApp`（LINE API）
- **認証:** Google Apps Scriptの実行ユーザーの権限を使用

### 8.5 レスポンシブ対応

- **予約画面:**
  - モバイルファースト設計
  - 最大幅: 672px（`max-w-2xl`）
  - タブレット・デスクトップでも見やすいレイアウト

- **管理画面:**
  - デスクトップファースト設計
  - サイドバー: 1024px以上で表示（`hidden lg:flex`）
  - タブレット以下: サイドバーを非表示、カレンダーを全幅表示

## 9. Lステップ連携

### 9.1 概要と疎通結果

Lステップ（LINE公式アカウント拡張）とTimeRex/GASを連携し、下記を自動化する。

- 予約導線の配信（postbackボタン → 予約URL）
- 予約/キャンセル時の友だち情報更新・タグ付与
- リマインド配信の制御

最新の疎通結果は `docs/LSTEP_CONNECTIVITY_SUMMARY.md` に記録済み。要点は以下の通り。

| 方式 | エンドポイント | 結果 | 備考 |
|------|----------------|------|------|
| REST `POST /friend/update` | `https://api.lineml.jp/v1/friend/update` | 404 | 契約プランでは提供されないため非対応 |
| トリガーURL | `https://api.lineml.jp/v1/api-codes/{code}/triggers/{id}` | 200 | 本番運用でもこの方式を採用 |

そのため、本システムでは **トリガーURL経由の友だち情報更新のみ** を利用し、REST API を呼び出さない。

### 9.2 設定サマリ（GAS側）

| 項目 | 値 / プロパティキー | 説明 |
|------|--------------------|------|
| LステップAPIトークン | `Config.PROPERTY_KEYS.LSTEP_API_KEY` → `'LSTEP_API_TOKEN'` | `PropertiesService` に保存 |
| トリガーURL | `Config.LSTEP_TRIGGER_URL_DEFAULT` | プロパティ未設定時に利用する既定値 |
| トリガー経由更新フラグ | `Config.LSTEP_USE_TRIGGER_URL = true` | 契約上RESTが使えないため必須 |
| UIDのみモード | `Config.LSTEP_UID_ONLY = false` | false で予約確定/キャンセル時に連携を実行 |
| UIDセッション保存 | CacheService + `sessions` シート | 有効期限10分、直近2分以内で検索 |

### 9.3 Lステップ側の設定

1. **Webhook転送（POST）**  
   - 設定場所: アカウント設定 → 外部連携設定 → LINE Webhook転送  
   - URL: Webアプリの本番デプロイURL（末尾にクエリを付けない）  
   - 受信先: `doPost` → `handleLStepWebhook`

2. **postbackボタン**  
   - テンプレート/シナリオで postback アクションを利用（例: `{"action":"booking","interviewer_id":"tanaka"}`）。  
   - タップ後にLステップ側のシナリオで予約URL（`...?action=lstep_webhook&interviewer_id=tanaka`）を送信する。

3. **トリガーURL連携**  
   - パラメータ管理に `meeting_date` / `meeting_url` / `meeting_cancel_url` / `tag` を登録し、友だち情報・タグにマッピングする。

### 9.4 UID取得から予約導線まで

1. **postbackタップ**  
   - Lステップ → GASへWebhook転送（POST）。`handleLStepWebhook` が UID と面談官IDを抽出。  
   - `session_id` を発行し、CacheService（600秒）と `sessions` シート（`session_id`, `uid`, `name`, `created_at`, `expires_at`, `interviewer_id`）へ保存。

2. **予約URLの送付**  
   - Lステップのシナリオが `...?action=lstep_webhook&interviewer_id=xxx` を応募者へ送信。

3. **応募者がURLを開く（GET）**  
   - `doGet` が `action=lstep_webhook` を検知し、`interviewer_id` と一致する直近2分以内の `session_id` を検索。  
   - 成功時は `...?session_id=...` にリダイレクト。見つからない場合は再タップを案内するエラーページを返す。

4. **予約画面表示**  
   - `handleBookingPage` が `session_id` から UID を復元（Cache → `sessions` の順）。  
   - Vue側で TimeRex ウィジェットを初期化し、`url_params.line_uid` に UID を設定。

### 9.5 TimeRex Webhook受信時の処理

- **予約確定 (`event_confirmed`)**  
  - `interviews` シートへ予約を追記。  
  - `LStepApiService.triggerFriendUpdate(lineUid, { meeting_date, meeting_url, meeting_cancel_url, tag })` を呼び出す。  
  - タグは `Config.LSTEP_TAG_NAMES.BOOKING_CONFIRMED` を使用。

- **キャンセル (`event_cancelled`)**  
  - `interviews.status` を `3`（キャンセル）へ更新。  
  - `triggerFriendUpdate(lineUid, { meeting_date: null, meeting_url: null, meeting_cancel_url: null })` で友だち情報をクリア。

トリガーURLへのPOSTは疎通済み（HTTP 200）。失敗時はログへ記録しつつ、予約処理自体は継続する。

### 9.6 テストと監視

| 目的 | GAS関数 | 補足 |
|------|---------|------|
| 基本疎通チェック | `runMinimumConnectivityTest` | TimeRex/Lステップのキー・シート設定をまとめて確認 |
| トリガーURL + UID テスト | `runLStepApiTriggerTestForSpecifiedUid` | HTTP 200 を確認 |
| トリガーURL + friend_id テスト | `runLStepApiTriggerTestForSpecifiedFriendId` | 友だちID指定で疎通 |
| REST 404 切り分け | `runLStep404Diagnostic` | REST API が404になる理由をログで確認 |

Pythonの疎通スクリプト（`scripts/connectivity_test.py`）でも同結果を再現可能。GASのみ失敗する場合は権限・プロパティ設定を再確認する。

### 9.7 トラブルシューティング要点

- Webhook転送URLにクエリ（`?action=...`）を付けると `postData` が届かない。  
- UIDが取得できない場合は postback ではなく URI アクションになっていないか確認。  
- 予約URLクリック後に「セッションが見つからない」場合はタップから2分以内か、`sessions` シートにレコードがあるかを確認。  
- トリガーURL呼び出しが失敗する場合は `LSTEP_API_TOKEN` / `LSTEP_TRIGGER_URL` の設定、またはLステップ側のパラメータ定義漏れを疑う。

### 9.x 旧仕様メモ（参考）

> **Note:** 以下は初期実装時の詳細メモ。現行仕様は9.3〜9.7を参照。

#### (Legacy) 前提条件

**重要:** 以下の前提条件を理解してください。

1. **URLにUIDは埋め込めません**
   - LステップのURLパラメータに直接UIDを含めることはできません
   - [LステップAPI連携の公式記事](https://linestep.jp/2025/12/08/lstep_api/)によると、**Webhook転送でUIDを転送することしかできません**

2. **UIDの把握はボタンタップによって行います**
   - メッセージ内のボタンをタップした際に、LステップのWebhook転送でUIDを取得します
   - LINE公式アカウントの標準イベントとして確実に動作します

3. **UIDの照合方法**
   - ボタンタップ時に取得したUIDを、予約システム側で保持します
   - 予約確定時（TimeRex Webhook受信時）に、保持していたUIDを使用してLステップAPIを呼び出します
   - これにより、**どのユーザーが予約したか**を正確に把握できます

#### (Legacy) UIDの受け渡しフロー（全体像）

UIDは以下の5つのステップで受け渡されます：

```
【ステップ1】Lステップ → GAS
  ボタンタップ → Webhook転送 → UID取得

【ステップ2】GAS → 予約システム
  セッションID生成 → スプレッドシートにUID保存 → リダイレクト

【ステップ3】予約システム → TimeRex
  セッションIDからUID取得 → TimeRexウィジェットのurl_paramsに設定

【ステップ4】TimeRex → GAS
  予約確定 → Webhook送信 → event.url_params.line_uidでUID取得

【ステップ5】GAS → Lステップ
  UIDを使用してLステップAPI呼び出し → 友だち情報更新・タグ設置
```

#### (Legacy) 詳細フロー

**参考:** [LステップWebhook転送機能のマニュアル](https://manual.linestep.net/kiji2458)

**Webhook転送の概要:**
- Webhook転送機能は、**LINE公式アカウントで発生した各種イベント**を、指定したWebhook URL(転送先)に送信できる機能です
- **重要**: 
  - 外部システムからのデータを受信することはできません
  - Lステップのデータを外部システムに送信する機能ではありません
  - **LINE公式アカウントで発生したイベントのみ**が対象です
- 設定方法: Lステップ管理画面 > アカウント設定 > 「外部連携設定」タブ > 「LINE Webhook転送設定」にWebhook URLを入力
- 設定保存後、次のイベント発生からデータが転送されます

**Lステップ側の設定:**

**重要:** セッションIDはLステップ側で取得する必要はありません。セッションIDはGAS側で生成し、リダイレクトURLに含めます。

**設定方法（2つのパターン）:**

**パターン1: ボタンにURLを設定する方法（推奨）**

**重要: LステップのURLは固定しか設定できません**

Lステップのテンプレートやボタンに設定するURLは固定値のみです。動的にパラメータを変更することはできません。

**解決策A: 担当者ごとに異なるテンプレート/ボタンを作成（推奨）**
1. **テンプレート機能でボタンを作成（担当者ごと）**
   - Lステップ管理画面 > 「テンプレート」 > 新規作成
   - テンプレート名: 「面談予約（担当者: 田中）」など、担当者を識別できる名前
   - フレックスメッセージまたはカルーセルメッセージで「予約する」ボタンを配置
   - ボタンのアクション: 「URIアクション」を選択
   - URI: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook&interviewer_id=tanaka`
     - 注意: `{SCRIPT_ID}`は実際の値に置き換える
     - `interviewer_id`は固定値（例: `tanaka`、`yamada`など）
   - 担当者ごとに異なるテンプレートを作成

2. **Webhook転送の設定（共通）**
   - Lステップ管理画面 > 「アカウント設定」 > 「外部連携設定」タブ > 「LINE Webhook転送設定」
   - Webhook URL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook`
   - 注意: ボタンタップ時にWebhook転送が発火し、UIDがペイロードに含まれる
   - **重要**: Webhook転送のURLは固定で、`interviewer_id`は含めない（ボタンのURIから取得）

**解決策B: 固定URLのみを使用し、`interviewer_id`を別の方法で渡す**
1. **テンプレート機能でボタンを作成（共通）**
   - Lステップ管理画面 > 「テンプレート」 > 新規作成
   - フレックスメッセージまたはカルーセルメッセージで「予約する」ボタンを配置
   - ボタンのアクション: 「URIアクション」を選択
   - URI: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook`
     - 注意: `interviewer_id`は含めない（固定URLのみ）

2. **`interviewer_id`の取得方法**
   - **方法1**: Lステップの友だち情報欄に`interviewer_id`を保存し、Webhook転送のペイロードから取得
   - **方法2**: Lステップのタグやカスタム検索で担当者を識別し、GAS側でマッピング
   - **方法3**: ステップ配信の条件分岐で、担当者ごとに異なるテンプレートを配信（解決策Aと同様）

3. **Webhook転送の設定（共通）**
   - Lステップ管理画面 > 「アカウント設定」 > 「外部連携設定」タブ > 「LINE Webhook転送設定」
   - Webhook URL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook`

**パターン2: URLクリック測定機能を使用する方法**
1. **URLクリック測定で短縮URLを発行**
   - Lステップ管理画面 > 「URLクリック測定」 > 新規作成
   - サイト名を入力して短縮URLを発行
   - 元のURL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook&interviewer_id={INTERVIEWER_ID}`

2. **メッセージにURLを設定**
   - テンプレートまたはメッセージ編集画面で、上記の短縮URLを設定
   - ユーザーがURLをクリックした際に、Webhook転送が発火

3. **リダイレクト先の設定（オプション）**
   - URLクリック測定詳細画面 > 「シナリオ配信」「一斉配信」「個別配信」タブ
   - リダイレクトを設定したいメッセージの「設定」ボタンをクリック
   - 「リダイレクト設定」に、予約システムのURLを入力
   - 注意: この方法では、GAS側でリダイレクト処理を行うため、リダイレクト先の設定は不要な場合があります

**参考マニュアル:**
- [テンプレート機能 概要](https://manual.linestep.net/about_template)
- [URLクリック測定 概要](https://manual.linestep.net/url)
- [リダイレクト先を設定する](https://manual.linestep.net/redirect)
   - 必要に応じて、`interviewer_id`などの追加パラメータも設定

**推奨される確認事項:**
1. Lステップの管理画面で、「ボタンタップ」イベントがWebhook転送の対象であることを確認
2. Webhook転送のペイロードにUIDが含まれるか確認
3. ペイロードの形式（JSON形式、パラメータ形式など）を確認
4. ボタンのアクションでURLリダイレクトが設定できるか確認

#### (Legacy) 詳細処理フロー（ボタンタップ方式）

**【ステップ1】ユーザーがボタンをタップ**
- Lステップから配信されたメッセージ内のボタン（例：「面談予約する」）をタップ
- **重要**: LINE公式アカウントで発生するイベントがWebhook転送の対象
- LINE公式アカウントの「ボタンタップ」イベントが発生
- LステップのWebhook転送が発火（ボタンタップ時に設定されたWebhook URLに転送）

**【ステップ2】GASでWebhook転送を受信し、UIDを一時保存**
- エンドポイント: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook`
- ペイロードからUIDを抽出
  - **重要**: URLパラメータ（`e.parameter.uid`）からは取得できません
  - POSTデータ（JSON形式）から取得を試行（`payload.uid`、`payload.user_id`、`payload.line_user_id`、`payload.source.userId`、`payload.events[0].source.userId`など）
  - **注意**: 実際のペイロード形式はLステップの仕様に依存するため、実装時に確認が必要
- **UIDを一時保存（uidlogシート）**
- **セッションIDを生成（UUID）**
- セッションIDとUIDの対応関係をuidlogシートに保存
  - **保存項目**: `日時`, `uid`, `sessionid`, `イベント種別`
  - **メリット**: 
    - デバッグしやすい（uidlogで確認可能）
    - 履歴を残せる
    - フォールバック用としてCacheServiceと併用

**【ステップ3】予約システムにリダイレクト**

**重要: セッションIDはGAS側で生成し、リダイレクトURLに含めます**

LステップのボタンのURLは固定しか設定できないため、セッションIDをボタンのURLに含めることはできません。代わりに、以下の方法でセッションIDを渡します：

1. **ボタンのURIアクション**: 固定URLのみ（セッションIDは含めない）
   - 例: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook&interviewer_id=tanaka`

2. **Webhook転送でUIDを取得後、GAS側で処理**:
   - `handleLStepWebhook`関数内でセッションIDを生成（`Utilities.getUuid()`）
   - セッションIDとUIDをスプレッドシートに保存
   - **リダイレクトURLにセッションIDを明示的に含める**

3. **リダイレクトURLの形式**:
   - `https://script.google.com/macros/s/{SCRIPT_ID}/exec?session_id={SESSION_ID}&interviewer_id={INTERVIEWER_ID}`
   - このURLにアクセスすると、`handleBookingPage`関数が呼び出される
   - `e.parameter.session_id`からセッションIDを取得できる

4. **HTMLレスポンスでリダイレクト**:
   - `<meta http-equiv="refresh">`と`window.location.href`の両方を使用（フォールバック対応）
   - ユーザーは自動的にリダイレクトされ、セッションIDを含むURLにアクセスする
   - **ブラウザのセキュリティ**: 同じドメイン（`script.google.com`）内へのリダイレクトのため、セキュリティアラートは表示されません

**【ステップ4】予約システム側でUIDを取得し、TimeRexに渡す**

**セッションIDの取得方法（重要）:**

**A. Webhook URLからのセッションID（`handleLStepWebhook`で生成）:**
- `handleLStepWebhook`関数内で、セッションIDを生成（`Utilities.getUuid()`）
- セッションIDとUIDをスプレッドシートに保存
- **リダイレクトURLにセッションIDを明示的に含める**

**B. 面接予約URLからのセッションID（`handleBookingPage`で取得）:**
- **重要**: このURLはLステップに埋め込むものではありません
- GAS側の`handleLStepWebhook`関数内でリダイレクトURLを生成し、HTMLレスポンスでリダイレクトします
- リダイレクトURL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?session_id={SESSION_ID}&interviewer_id={INTERVIEWER_ID}`
  - このURLはGAS側で動的に生成されます（Lステップの固定URLではありません）
- ユーザーがリダイレクトされたURLにアクセスすると、GASの`doGet`関数が呼び出され、`e.parameter.session_id`からセッションIDを取得
- **このセッションIDは、Aで生成されたセッションIDと同じ値です**
- セッションIDを使用してスプレッドシートからUIDを取得

**なぜセッションIDがリダイレクトURLに含まれるのか:**
- `handleLStepWebhook`関数内で、セッションIDを生成した後、**明示的にリダイレクトURLに含めています**
- これにより、予約システム側（`handleBookingPage`）でセッションIDを取得し、スプレッドシートからUIDを取得できるようになります
- **AとBのセッションIDは同じ値であり、これによりUIDの照合が可能になります**

**実装の流れ:**
1. **セッションIDの生成とリダイレクトURLへの含め込み（`handleLStepWebhook`関数内）:**
   ```javascript
   // セッションIDを生成
   const sessionId = Utilities.getUuid();
   
   // uidlogシートに保存（日時, uid, sessionid, イベント種別）
   SpreadsheetService.saveToUidlog(uid, sessionId, 'postback');
   
   // リダイレクトURLにセッションIDを明示的に含める
   const redirectUrl = `https://script.google.com/macros/s/${scriptId}/exec?session_id=${sessionId}${interviewerId ? '&interviewer_id=' + interviewerId : ''}`;
   
   // HTMLレスポンスでリダイレクト
   return HtmlService.createHtmlOutput(`<meta http-equiv="refresh" content="0;url=${redirectUrl}">`);
   ```

2. **予約システム側でのセッションID取得（`handleBookingPage`関数内）:**
   - ユーザーがリダイレクトされたURL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec?session_id={SESSION_ID}&interviewer_id={INTERVIEWER_ID}`
   - GASの`doGet`関数が呼び出され、`e.parameter.session_id`から取得できます
   ```javascript
   const sessionId = e.parameter.session_id;  // URLパラメータから取得
   ```

**UIDの取得方法:**
- セッションIDからuidlogシートからUIDを取得
  ```javascript
  if (sessionId) {
    uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId) || '';
  }
  ```
- `Booking.html`でUIDを保持し、TimeRexウィジェットの`url_params`に設定
  - `config['url_params']['line_uid'] = uid`
  - これにより、TimeRexの予約データにUIDが紐づけられます

**【ステップ5】予約確定時（TimeRex Webhook受信時）にUIDを照合**
- TimeRexからWebhookが送信される
- `event.url_params.line_uid` からUIDを取得
- **このUIDを使用してLステップAPIを呼び出し**
  - `LStepApiService.updateFriendInfo(uid, { meeting_date, meeting_url, meeting_cancel_url })`
  - `LStepApiService.addTag(uid, '面談予約済み')`
- **これにより、どのユーザーが予約したかを正確に把握し、Lステップの友だち情報を更新できます**

#### (Legacy) UIDの照合フロー（参考）

**UIDの照合は以下の流れで行われます：**

```
┌─────────────────────────────────────────────────────────────────┐
│ 【ステップ1】ボタンタップ時                                      │
│ Lステップ → Webhook転送 → GAS → UID取得 → スプレッドシートに保存│
│ 保存先: uidlogシート（日時, uid, sessionid, イベント種別）         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 【ステップ2】予約システムアクセス時                               │
│ セッションID → スプレッドシート → UID取得 → TimeRexウィジェット設定│
│ url_params.line_uid = {UID}                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 【ステップ3】予約確定時（TimeRex Webhook受信時）                 │
│ TimeRex → Webhook → event.url_params.line_uid → UID取得         │
│ このUIDが、ステップ1で取得したUIDと一致することを確認            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 【ステップ4】LステップAPI呼び出し時                              │
│ 取得したUIDを使用してLステップAPIを呼び出し                      │
│ - updateFriendInfo(uid, { meeting_date, meeting_url, ... })    │
│ - addTag(uid, '面談予約済み')                                    │
│ → これにより、どのユーザーが予約したかを正確に把握できる        │
└─────────────────────────────────────────────────────────────────┘
```

**重要なポイント:**
- **URLにUIDは埋め込めません** → ボタンタップ時のWebhook転送で取得
- **UIDはセッションID経由で受け渡します** → uidlogシートで記録
- **予約確定時にUIDを照合します** → TimeRex Webhookの`url_params`から取得したUIDを使用
- **同じUIDが一貫して使用されます** → ボタンタップ時から予約確定時まで同じUIDを使用
- **UIDの照合により、どのユーザーが予約したかを正確に把握できます** → LステップAPIで友だち情報を更新

**実装例（Code.gs）:**
```javascript
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'lstep_webhook') {
    return handleLStepWebhook(e);
  } else if (e.parameter.page === 'admin') {
    return handleAdminPage(e);
  } else {
    return handleBookingPage(e);
  }
}

function handleLStepWebhook(e) {
  try {
    Logger.log('[handleLStepWebhook] LステップWebhook転送を受信（ボタンタップ）');
    Logger.log('[handleLStepWebhook] Parameters: ' + JSON.stringify(e.parameter));
    Logger.log('[handleLStepWebhook] POST Data: ' + (e.postData ? e.postData.contents : 'none'));
    
    // LステップのWebhook転送からUIDを取得
    // 注意: ペイロードの形式はLステップの仕様に依存
    // ボタンタップ時のWebhook転送では、LINE公式アカウントのイベントデータが含まれる
    // 重要: URLパラメータからUIDを取得することはできません（e.parameter.uidは使用しない）
    let uid = '';
    
    // POSTデータから取得を試行（JSON形式の場合）
    if (!uid && e.postData && e.postData.contents) {
      try {
        const payload = JSON.parse(e.postData.contents);
        // LINE公式アカウントのイベントデータからUIDを抽出
        uid = payload.uid || 
              payload.user_id || 
              payload.line_user_id || 
              payload.source?.userId || 
              payload.events?.[0]?.source?.userId || 
              '';
        Logger.log('[handleLStepWebhook] UID extracted from POST data: ' + uid);
      } catch (parseError) {
        Logger.log('[handleLStepWebhook] Failed to parse POST data: ' + parseError.toString());
      }
    }
    
    if (!uid) {
      Logger.log('[handleLStepWebhook] ⚠️ UID not found in webhook payload');
      Logger.log('[handleLStepWebhook] Available parameters: ' + JSON.stringify(Object.keys(e.parameter)));
      // UIDが取得できない場合はエラーページを返す
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>エラー | 予約システム</title>
        </head>
        <body>
          <h1>UID取得に失敗しました</h1>
          <p>LステップのWebhook転送からUIDを取得できませんでした。</p>
          <p>設定を確認してください。</p>
        </body>
        </html>
      `);
    }
    
    Logger.log('[handleLStepWebhook] ✅ UID extracted: ' + uid);
    
    // セッションIDを生成
    const sessionId = Utilities.getUuid();
    
    // uidlogシートに保存（日時, uid, sessionid, イベント種別）
    SpreadsheetService.saveToUidlog(uid, sessionId, 'postback');
    Logger.log('[handleLStepWebhook] UID saved to uidlog with session_id: ' + sessionId);
    
    // 予約システムにリダイレクト
    // ボタンタップ方式では、GAS側でリダイレクト処理を行う
    const interviewerId = e.parameter.interviewer_id || '';
    const scriptId = ScriptApp.getScriptId();
    const redirectUrl = `https://script.google.com/macros/s/${scriptId}/exec?session_id=${sessionId}${interviewerId ? '&interviewer_id=' + interviewerId : ''}`;
    
    Logger.log('[handleLStepWebhook] Redirecting to: ' + redirectUrl);
    
    // HTMLレスポンスでリダイレクト（ボタンタップ後の自動リダイレクト）
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
        <title>リダイレクト中...</title>
      </head>
      <body>
        <p>予約ページに移動しています...</p>
        <script>
          // 即座にリダイレクト
          window.location.href = '${redirectUrl}';
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    Utils.logError('handleLStepWebhook', error, { parameters: e.parameter });
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>エラー | 予約システム</title>
      </head>
      <body>
        <h1>エラーが発生しました</h1>
        <p>${error.toString()}</p>
      </body>
      </html>
    `);
  }
}
```

**handleBookingPageの修正:**
```javascript
function handleBookingPage(e) {
  let uid = '';
  
  // 【重要】セッションIDの取得方法
  // セッションIDは、handleLStepWebhook関数内でリダイレクトURLに明示的に含められます
  // リダイレクトURL例: https://script.google.com/macros/s/{SCRIPT_ID}/exec?session_id={SESSION_ID}
  // このURLにアクセスすると、GASのdoGet関数が呼び出され、e.parameter.session_idから取得できます
  const sessionId = e.parameter.session_id;
  
  // セッションIDからuidlogシートからUIDを取得
  if (sessionId) {
    uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId) || '';
    if (uid) {
      Logger.log(`[handleBookingPage] ✅ UID retrieved from uidlog: ${uid}`);
    } else {
      Logger.log(`[handleBookingPage] ⚠️ UID not found in uidlog for session_id: ${sessionId}`);
    }
  } else {
    Logger.log(`[handleBookingPage] ⚠️ session_id parameter not found in URL`);
  }
  
  // 注意: URLパラメータからUIDを直接取得することはできません
  // UIDは必ずボタンタップ時のWebhook転送経由で取得し、セッションID経由で受け渡します
  
  const interviewerId = e.parameter.interviewer_id || null;
  // ... 以下既存の処理
}
```

#### (Legacy) 予約確定時の処理

**処理フロー:**
1. TimeRex Webhook受信（`event_confirmed`）
2. LINE UID抽出（`event.url_params`から）
3. LステップAPI呼び出し:
   - **友だち情報更新** (`/friend/update`):
     - `meeting_date`: 面談日時（`YYYY-MM-DD HH:mm`形式）
     - `meeting_url`: ミーティングURL（Zoom/Google Meet/Microsoft Teams）
     - `meeting_cancel_url`: キャンセルURL（LINE配信でのキャンセルに使用）
   - **タグ設置** (`/friend/tag/add`):
     - タグ名: `面談予約済み`
4. ログ記録（uidlogシート）

**エラーハンドリング:**
- LステップAPI連携失敗時も予約処理は継続（エラーはログに記録）
- 指数バックオフによるリトライ（最大3回）

#### (Legacy) キャンセル時の処理

**処理フロー:**
1. TimeRex Webhook受信（`event_cancelled`）
2. スプレッドシートのステータス更新（`3: キャンセル`）
3. LINE UID抽出（スプレッドシートから）
4. LステップAPI呼び出し:
   - **友だち情報クリア** (`/friend/update`):
     - `meeting_date`: `null`
     - `meeting_url`: `null`
     - `meeting_cancel_url`: `null`
5. ログ記録

**リマインド配信停止:**
- Lステップ側でリマインド配信の条件を `meeting_date` に値があることとする
- `meeting_date` を `null` にすることで、リマインド配信が自動停止される

#### (Legacy) キャンセル方法

**ゲスト（応募者）によるキャンセル:**
- **方法1**: TimeRexのキャンセルURL（`event.guest_cancel_url`）にアクセス
- **方法2**: LINE配信メッセージ内のキャンセルURL（`{{meeting_cancel_url}}`）をクリック
  - Lステップのリマインド配信テンプレートに `{{meeting_cancel_url}}` を含める
  - クリック時にTimeRexのキャンセルURLにリダイレクト

**ホスト（面談官）によるキャンセル:**
- TimeRex管理画面からキャンセル
- Googleカレンダーから予定を削除（TimeRexが自動検知）

#### (Legacy) 再送信（手動配信）

**用途:**
- 担当者ごとのURLを再送信する場合
- 特定の応募者に個別にURLを送信する場合

**手順:**
1. Lステップ管理画面で該当応募者を選択
2. LINEテンプレートを選択（担当者ごとのURLを登録済み）
3. 手動で配信実行

**注意:**
- 再送信時もボタンタップ時のWebhook転送経由でLINEユーザーIDを取得すること
- 担当者指定がある場合は `&interviewer_id=xxx` を追加

#### (Legacy) LステップAPI仕様

**ベースURL:**
```
https://api.lineml.jp/v1
```

**認証:**
- APIキーを `PropertiesService` に保存
- リクエストヘッダー: `Authorization: Bearer {API_KEY}`

**主要エンドポイント:**
- `POST /friend/update`: 友だち情報更新
- `POST /friend/tag/add`: タグ追加
- `POST /friend/tag/remove`: タグ削除

**識別子:**
- **必須**: `uid`（LINEユーザーID）または `lstepid`（Lステップ内部ID）のいずれか
  - API連携では、UIDまたはfriendIDを必ず使用する必要があります
  - 外部システム（本システム）でもUIDを把握していることが必須です
- デフォルト: `uid`（LINEユーザーID）を使用
- オプション: `lstepid`（Lステップ内部ID）
  - APIエラー時（`uid`で友だちが見つからない場合）は `lstepid` を試行

**重要事項:**
- LステップAPI連携では、UIDまたはfriendIDのないAPI連携の設定自体ができません
- 導入前に、外部システムでUIDを把握できていることを必ず確認してください
- 参考: [LステップAPI連携の公式記事](https://linestep.jp/2025/12/08/lstep_api/)

#### (Legacy) ログ記録

**uidlogシート（`uidlog`）:**
- カラム: `日時`, `uid`, `sessionid`, `イベント種別`
- UID取得ログ（postback等）、LSTEP API結果、エラー、Webhook受信などを記録

**用途:**
- デバッグ・トラブルシューティング
- 連携状況の監視
- エラー発生時の原因調査

#### (Legacy) 設定項目

**Script Properties:**
- `LSTEP_API_KEY`: LステップAPIキー
  - **注意**: API連携の申請方法は、[Lステップ×AI 外部連携セミナー](https://linestep.jp/2025/12/08/lstep_api/)（オンライン／参加費無料）にご参加いただいた方のみ、申請が可能となります

**Config.gs:**
- `LSTEP_API_BASE_URL`: `https://api.lineml.jp/v1`
- `LSTEP_TAG_NAMES.BOOKING_CONFIRMED`: `面談予約済み`

**参考資料:**
- [LステップAPI連携の公式記事](https://linestep.jp/2025/12/08/lstep_api/) - API連携の仕組み、活用例、注意事項が詳しく解説されています

#### (Legacy) トラブルシューティング

#### LINE IDが取得できない場合

**症状:**
- LステップAPI連携でエラーが発生する
- `line_uid`が空または`null`になる
- uidlogシートに`LSTEP_API_SKIP`が記録される

**原因:**
1. Lステップ側でURLにLINE IDを含める変数が正しく設定されていない
2. ボタンタップ時のWebhook転送からLINE IDが取得できていない
3. TimeRexウィジェットの`url_params`に`line_uid`が設定されていない

**解決方法:**
1. **Lステップ側の設定を確認**
   - メッセージテンプレートにボタンを配置しているか確認
   - ボタンのアクションでWebhook転送が設定されているか確認
   - Webhook転送先URLが正しく設定されているか確認（`https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=lstep_webhook`）

2. **デバッグログを確認**
   - `Code.gs`の`handleBookingPage`で`uid`の値を確認
   - `Booking.html`で`userData.uid`の値を確認
   - `WebhookHandler.gs`で`line_uid`の値を確認

3. **Webhook転送の確認**
   - GASのログでWebhook転送が受信されているか確認
   - ペイロードにUIDが含まれているか確認（POSTデータの形式を確認）
   - uidlogシートにUIDが保存されているか確認（sessionidとuidの対応関係）

**詳細は `docs/LSTEP_LINEID_SOLUTION.md` を参照してください。**

## 10. 拡張性

Google Calendar APIがGASに統合されているため、将来的に以下の機能追加が容易：

### 10.1 通知機能

- **リマインド通知**: 予約前日に自動でメール通知
- **翌日の予定取得**: トリガーで毎日実行し、翌日の予約を取得して通知

### 10.2 データ分析

- **予約統計**: スプレッドシートデータを集計してダッシュボード表示
- **カレンダー同期チェック**: 定期的にTimeRexとGoogleカレンダーの同期状態を確認

### 10.3 API機能の拡張

- **イベント検索**: TimeRex APIを使用して予約データを検索
- **一括操作**: 複数イベントの一括キャンセル等

### 10.4 ウィジェット機能の拡張

- **カスタムフォーム**: ウィジェットのカスタムフィールドを活用
- **マルチカレンダー**: 複数のカレンダーを動的に切り替え

## 11. 優先順位ロジック仕様

### 11.1 概要

Webhook受信時に複数の面談官が含まれる場合、優先順位に基づいて自動で面談官をアサインする機能。

### 11.2 データ構造

- **`interviewers.priority`（E列）**: 優先順位（数値型）
  - 低い数値ほど優先度が高い（1が最優先）
  - 未設定（空）の場合は最大値として扱う（最優先度が低い）
  - 優先順位が同じ場合は登録順（行番号）で決定

### 11.3 アサインロジック

1. Webhook受信時に`event.hosts`から全ての面談官のメールアドレスを取得
2. `interviewers`シートから該当する面談官を検索（優先順位でソート済み）
3. `event.hosts`に含まれる面談官のメールアドレスに一致する面談官を抽出
4. 各面談官のGoogleカレンダーをチェック（カレンダーアクセスエラーの場合はスキップ）
5. 複数の面談官が含まれる場合:
   - 既に優先順位でソートされているため、最初の面談官が最優先
   - 優先順位が同じ場合は登録順（行番号）で決定
   - 最優先の面談官にアサイン
6. `interviews.interviewer_id`に面談官IDを設定
7. **注意**: TimeRexが既に予約を確定しているため、実際には`event.hosts`に含まれる面談官の中から選択する。カレンダー空き確認は、将来的にカレンダー空き確認機能を追加する場合に使用する。

### 11.4 管理画面での設定

- **表示位置**: サイドバーの統計情報の上
- **表示形式**: 面談官名を優先順位順に横並びで表示（例：川島 > 尾座本 > 川崎）
- **設定方法**: 「設定」ボタンでモーダルを開き、各面談官の優先順位を数値で入力
- **保存**: 一括保存機能で`interviewers`シートの`priority`カラムを更新

### 11.5 カレンダー表示ロジック

#### 11.5.1 予約画面

- **`interviewer_id`パラメータなし**:
  - 統合カレンダー（複数名の空き時間を表示）を使用
  - `TIMEREX_TEAM_CALENDAR_URL_PATH`（PropertiesService）から取得
  - 設定が未完了の場合はエラーメッセージを表示
  - 予約アサイン: 優先順位ロジックに基づいて自動アサイン

- **`interviewer_id`パラメータあり**:
  - その面談官の個別カレンダーを使用
  - `interviewers`シートから該当面談官を取得し、`timerex_config_id`を使用
  - 面談官が見つからない場合、または`timerex_config_id`が未設定の場合はエラーメッセージを表示
  - 予約アサイン: その面談官にアサイン

#### 11.5.2 管理画面

- 面談官一覧を優先順位順に表示
- 優先順位設定機能で管理画面から変更可能
