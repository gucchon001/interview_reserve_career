# 日程調整システム（GAS版）

TimeRex API、カレンダーウィジェット、Webhookを活用したGoogle Apps Script (GAS) 日程調整システムです。

## プロジェクト構成

```
.
├── .clasp.json              # clasp設定（clasp create後に生成）
├── appsscript.json          # GAS設定
├── src/                     # サーバーサイドコード・HTML
│   ├── Code.gs              # エントリーポイント（doGet, doPost）
│   ├── Config.gs            # 設定定数
│   ├── Utils.gs             # ユーティリティ関数
│   ├── SpreadsheetService.gs # スプレッドシート操作
│   ├── PropertyService.gs   # プロパティ管理
│   ├── WebhookHandler.gs    # Webhook処理
│   ├── CalendarService.gs   # Google Calendar操作
│   ├── AdminApiService.gs   # 管理画面APIサービス
│   ├── TimeRexApiService.gs # TimeRex API連携
│   ├── CacheService.gs      # キャッシュサービス
│   ├── Booking.html         # 予約画面
│   ├── Admin.html           # 管理画面
│   └── appsscript.json      # GAS設定
└── docs/                    # 仕様書・ドキュメント
```

## セットアップ

### 1. clasp環境構築

```bash
# claspをインストール（未インストールの場合）
npm install -g @google/clasp

# Googleアカウントでログイン
clasp login

# GASプロジェクトを作成
clasp create --type standalone --title "日程調整システム"

# .clasp.jsonが生成されるので、内容を確認
```

### 2. スプレッドシート準備

1. Google Spreadsheetを作成
2. 以下のシートを作成：

#### interviewers シート

| A列 (id) | B列 (name) | C列 (timerex_config_id) | D列 (google_calendar_id) | E列 (is_default) |
|---------|-----------|------------------------|-------------------------|-----------------|
| tanaka  | 田中 太郎  | member-tanaka          | tanaka@example.com      | TRUE            |

#### interviews シート

| A (created_at) | B (start_at) | C (end_at) | D (guest_name) | E (guest_email) | F (meet_url) | G (line_uid) | H (source) | I (event_id) | J (team_url_path) | K (calendar_url_path) | L (status) |
|---------------|-------------|-----------|---------------|----------------|-------------|-------------|-----------|-------------|------------------|---------------------|-----------|
| ...           | ...         | ...       | ...           | ...            | ...         | ...         | ...       | ...         | ...              | ...                 | ...       |

### 3. スクリプトプロパティ設定

APIキーや機密情報は**スクリプトプロパティ**で管理します。以下の2つの方法で設定できます。

#### 方法1: GASエディタのUIから設定（推奨）

1. GASエディタで `ファイル > プロジェクトの設定 > スクリプト プロパティ`
2. 以下のプロパティを追加：

| プロパティキー | 説明 | 例 |
|--------------|------|-----|
| `TIMEREX_WEBHOOK_TOKEN` | TimeRex Webhookセキュリティトークン（オプション）<br>**注意**: TimeRexのWebhook設定画面（Team Settings → Integrations）では、セキュリティトークンを生成・確認する機能が存在しない可能性があります。設定画面で確認できる場合は設定を推奨します。 | `abc123...` |
| `TIMEREX_TEAM_URL_PATH` | TimeRexチームURLパス | `mixtend_e6ed` |
| `TIMEREX_CALENDAR_URL_PATH` | TimeRexカレンダーURLパス | `215aa110` |
| `SPREADSHEET_ID` | スプレッドシートID（オプション、スクリプトがスプレッドシートに紐づいている場合は不要） | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` |
| `TIMEREX_API_KEY` | TimeRex APIキー（Phase 4で実装予定） | `api_key_...` |
| `LINE_ACCESS_TOKEN` | LINE Messaging APIアクセストークン（オプション） | `Bearer ...` |

#### 方法2: スクリプト関数から設定

GASエディタで以下の関数を実行：

```javascript
// スクリプトエディタで実行
setScriptProperties({
  // TIMEREX_WEBHOOK_TOKEN: 'your-webhook-token', // オプション: TimeRex設定画面で確認できる場合のみ設定
  TIMEREX_TEAM_URL_PATH: 'your-team',
  TIMEREX_CALENDAR_URL_PATH: 'your-calendar-id',
  SPREADSHEET_ID: 'your-spreadsheet-id'
});
```

#### 設定確認

以下の関数で設定状況を確認できます：

```javascript
// 必須プロパティの設定状況を確認
validateScriptProperties();

// すべてのプロパティを確認（デバッグ用、機密情報が含まれるため注意）
getScriptProperties();
```

### 4. コードデプロイ

```bash
# コードをGASにアップロード
clasp push

# GASエディタで確認
clasp open
```

### 5. Webアプリとして公開

1. GASエディタで `公開 > ウェブアプリとして公開`
2. 実行ユーザー: 自分
3. アクセス権限: 全員（匿名ユーザーを含む）
4. バージョン: 新規作成
5. URLをコピー

### 6. TimeRex Webhook設定

1. TimeRex管理画面 > チーム設定 > Integrations
2. Webhook URL: `https://script.google.com/macros/s/{SCRIPT_ID}/exec`
3. セキュリティトークンのHTTPヘッダー: `x-timerex-authorization` を選択
4. セキュリティトークンをコピーしてGASプロパティに設定（`TIMEREX_WEBHOOK_TOKEN`）

### 7. アクセスURL

**重要:** 実際のURLは、GASエディタの「公開 > デプロイを管理」から取得してください。

#### Google Workspace組織の場合（tomonokai-corp.com）

| 画面 | URL |
|------|-----|
| **予約画面**（デフォルト） | `https://script.google.com/a/macros/tomonokai-corp.com/s/{DEPLOYMENT_ID}/exec?uid={LINE_USER_ID}` |
| **管理画面** | `https://script.google.com/a/macros/tomonokai-corp.com/s/{DEPLOYMENT_ID}/exec?page=admin` |

**実際のURL例:**
- 予約画面: `https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbyBpo5szArOB5Zd2bviSQDzKz-rpOzIB0D19PiMbF8tI_Kmq_zr5RWpcFP3DOLF791SDQ/exec?uid=U1234567890abcdef`
- 管理画面: `https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbyBpo5szArOB5Zd2bviSQDzKz-rpOzIB0D19PiMbF8tI_Kmq_zr5RWpcFP3DOLF791SDQ/exec?page=admin`

#### 通常のGoogleアカウントの場合

| 画面 | URL |
|------|-----|
| **予約画面**（デフォルト） | `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?uid={LINE_USER_ID}` |
| **管理画面** | `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?page=admin` |

## 開発フロー

### ローカル開発

```bash
# コードをプル
clasp pull

# コードをプッシュ
clasp push

# GASエディタで開く
clasp open

# ログを確認
clasp logs
```

## 実装状況

### Phase 0: プロジェクト初期化 ✅
- [x] ディレクトリ構造作成
- [x] appsscript.json設定
- [x] 基盤コード実装（Config.gs, Utils.gs, SpreadsheetService.gs）

### Phase 1: Webhook受信機能 ✅
- [x] WebhookHandler.gs実装
- [x] Code.gs doPost実装
- [x] セキュリティトークン検証実装
- [ ] テスト・検証（手動）

### Phase 2: 予約画面 ✅
- [x] サーバーサイド実装（Code.gs doGet）
- [x] クライアントサイド実装（Booking.html）
- [x] TimeRexウィジェット統合
- [x] 画面表示確認
- [ ] 統合テスト（TimeRexウィジェット動作確認、予約フロー確認）

### Phase 3: 管理画面 ✅
- [x] サーバーサイド実装（CalendarService.gs, AdminApiService.gs）
- [x] クライアントサイド実装（Admin.html）
- [x] FullCalendar統合
- [x] 手動予約登録機能
- [x] 時間ブロック機能
- [x] 画面表示確認
- [ ] 統合テスト（データ取得確認、手動登録動作確認）

### Phase 4: 機能拡張・最適化 ✅
- [x] エラーハンドリング実装（各Serviceクラス）
- [x] ログ機能実装（Utils.gs）
- [x] TimeRex API実装（TimeRexApiService.gs）
  - [x] 予約情報取得（Get Event, Get Calendar Events）
  - [x] イベント操作（Cancel Event）
  - [x] 一括操作機能（cancelEventsBatch）
- [x] パフォーマンス最適化（CacheService.gs実装、GETリクエストのキャッシュ）
- [x] セキュリティ強化（入力検証の徹底、eventId形式検証、文字列長検証）

### Phase 5: テスト・検証 🔄
- [x] 基本設定完了（スクリプトプロパティ設定確認）
- [x] 画面表示確認（予約画面・管理画面）
- [x] L-step 疎通確認（トリガーURL 経由で GAS・Python ともに成功。REST /friend/update は契約上 404 のためトリガーURL のみ利用）
- [ ] Webhook動作確認（TimeRexで予約作成 → スプレッドシート記録確認）
- [ ] 予約フロー全体の E2E 確認（L-step ボタン → UID 取得 → 予約画面 → 確定 → L-step 友だち情報更新）
- [ ] 管理画面機能確認（データ取得、統計情報表示、手動登録）
- [ ] TimeRex API動作確認（イベント取得、キャンセル機能）
- [ ] エラーハンドリング確認（不正データ、ネットワークエラー等）

### L-step 連携 ✅
- [x] Webhook 転送で UID 取得・セッション管理・予約画面リダイレクト
- [x] 予約確定・キャンセル時の友だち情報更新（トリガーURL 経由。詳細は [L-step 疎通まとめ](docs/LSTEP_CONNECTIVITY_SUMMARY.md)）

## TimeRex設定

TimeRex側の設定手順については、[TimeRex設定ガイド](docs/TIMEREX_SETUP.md)を参照してください。

TimeRexウィジェットのカスタマイズについては、[TimeRexウィジェットカスタマイズガイド](docs/TIMEREX_WIDGET_CUSTOMIZATION.md)を参照してください。

## テスト・検証

### クイックテスト（API疎通確認）

GASエディタで以下の関数を実行して、各APIとトークンの疎通確認を行えます：

```javascript
// スプレッドシートシート作成（初回のみ）
setupSpreadsheetSheets();    // 必要なシートとヘッダーを自動作成

// 全テストを実行（概要のみ）
runAllApiTests();

// 個別テスト
runTimeRexApiKeyTest();      // TimeRex APIキー確認
runTimeRexApiTest();          // TimeRex API疎通確認
runWebhookTokenTest();        // Webhookトークン確認
runGoogleCalendarTest();      // Google Calendar API確認（実行ユーザーを自動登録）
runSpreadsheetTest();         // Spreadsheet API確認
runConfigTest();              // 設定値確認

// 詳細テスト（実際のイベントIDが必要）
runTimeRexApiDetailTest('event-id-here');
```

### Webhookテスト

モックデータを使用してWebhook処理をテストできます：

```javascript
// Webhook全テスト（event_confirmed → event_cancelled）
runAllWebhookTests();

// 個別テスト
runWebhookConfirmedTest();   // 予約確定Webhookテスト
runWebhookCancelledTest();   // 予約キャンセルWebhookテスト（eventId指定可）
runWebhookCancelledTest('event-id-here');  // 特定のeventIdでテスト
```

**注意:**
- `runWebhookConfirmedTest()`は`interviews`シートに新しいレコードを追加します
- `runWebhookCancelledTest()`は`interviews`シートの既存レコードの`status`を更新します
- テスト後はスプレッドシートを確認して、データが正しく記録されているか確認してください

### 予約画面統合テスト

予約画面のサーバーサイド処理とURL生成をテストできます：

```javascript
// 予約画面統合テスト
runBookingPageTest();

// 予約画面URLを取得
getBookingPageUrl('U1234567890abcdef');  // uid付きURL
getBookingPageUrl();                     // 基本URL

// 管理画面URLを取得
getAdminPageUrl('interviewer-id');       // interviewer_id付きURL
getAdminPageUrl();                       // 基本URL
```

**テスト内容:**
- TimeRexベースURLの生成確認
- スクリプトプロパティの確認
- 予約画面URLの生成
- handleBookingPage関数の動作確認

**次のステップ:**
テスト実行後、ログに表示されるURLにアクセスして、実際の画面表示を確認してください。

詳細なテスト手順は [TESTING.md](TESTING.md) を参照してください。

### 次のステップ

1. **E2E 確認**: L-step ボタン → UID 取得 → 予約画面 → 予約確定 → L-step 友だち情報・タグ反映の一連の流れを確認
2. **Webhook動作確認**: TimeRexで予約を作成し、スプレッドシートに記録されるか確認
3. **予約画面動作確認**: TimeRexウィジェットが正しく表示され、予約が作成できるか確認
4. **管理画面動作確認**: データ取得、統計情報、手動登録機能が正しく動作するか確認

今後の開発計画の詳細は [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) を参照してください。

## 参考資料

- [設計書](docs/spec.md)
- [開発計画](docs/DEVELOPMENT_PLAN.md)
- [L-step 疎通まとめ](docs/LSTEP_CONNECTIVITY_SUMMARY.md)
- [API 疎通テスト手順](docs/API_CONNECTIVITY_TEST.md)
- [テスト・検証ガイド](TESTING.md)
- [TimeRex APIリファレンス](docs/timerex/api_reference_20251220_171159.md)
- [TimeRex Webhookリファレンス](docs/timerex/webhook_reference_20251220_171159.md)
- [TimeRex ウィジェットリファレンス](docs/timerex/calendar_widget_20251220_171159.md)

