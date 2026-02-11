# Webhook設定ガイド

## 概要

TimeRexで予約が確定・キャンセルされた際に、Google Apps Script (GAS) に通知を受け取り、interviewsシートに自動記録するためのWebhook設定手順です。

## フロー

```
1. ユーザーがTimeRexで予約を作成
   ↓
2. TimeRexがWebhookをGASに送信（POST）
   ↓
3. GASのdoPost関数がWebhookを受信
   ↓
4. WebhookHandler.handleEventConfirmed()が呼ばれる
   ↓
5. SpreadsheetService.appendInterview()でinterviewsシートに記録
```

## 設定手順

### 1. GASのWebアプリURLを取得

1. GASエディタを開く
2. **公開** > **デプロイを管理** をクリック
3. **新しいデプロイ** をクリック
4. **種類の選択** で **ウェブアプリ** を選択
5. **説明** を入力（例: "Webhook endpoint"）
6. **次のユーザーとして実行** を **自分** に設定
   - **重要**: WebhookはTimeRexから送信されるため、特定のユーザーがアクセスしているわけではありません
   - 「自分」で実行することで、常にデプロイしたユーザー（管理者）の権限で実行されます
   - これにより、スプレッドシートへの書き込み権限が確実に保証されます
7. **アクセスできるユーザー** を **全員** に設定
   - 「自分」で実行する場合のみ、「全員」が選択可能になります
   - これにより、TimeRexからのWebhookが確実に到達します
8. **デプロイ** をクリック
9. **WebアプリのURL** をコピー

**重要:** WebアプリのURLは以下の形式です：
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

このURLがWebhookエンドポイントになります。

### 2. TimeRex側でWebhookを設定

1. TimeRex管理画面にログイン
2. **チーム設定** > **Integrations** を開く
3. **Webhook** セクションで **追加** をクリック
4. **Webhook URL** に、上記でコピーしたGASのWebアプリURLを貼り付け
   ```
   https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
   ```
5. **セキュリティトークン** が自動生成・表示されたら、それをコピー
6. **保存** をクリック

**注意:** セキュリティトークンは設定後に確認できない場合があります。必ずコピーしてください。

### 3. GAS側でセキュリティトークンを設定

コピーしたセキュリティトークンをGASのスクリプトプロパティに設定します。

#### 方法1: GASエディタから直接設定

1. GASエディタを開く
2. **プロジェクトの設定**（歯車アイコン）をクリック
3. **スクリプトプロパティ** セクションで以下を追加：

| プロパティキー | 値 | 説明 |
|--------------|-----|------|
| `TIMEREX_WEBHOOK_TOKEN` | `コピーしたセキュリティトークン` | TimeRex Webhookセキュリティトークン |

#### 方法2: スクリプト関数から設定

GASエディタで以下の関数を実行：

```javascript
function setWebhookToken() {
  const token = 'コピーしたセキュリティトークン'; // ここに実際のトークンを貼り付け
  PropertiesService.getScriptProperties().setProperty('TIMEREX_WEBHOOK_TOKEN', token);
  Logger.log('Webhook token set successfully');
}
```

**注意:** セキュリティトークンが設定されていない場合でも、Webhookは受信されますが、セキュリティ検証はスキップされます（本番環境では推奨されません）。

## 動作確認

### 1. Webhookテスト関数を実行

GASエディタで以下の関数を実行して、Webhook処理をテストできます：

```javascript
// Webhookテスト（event_confirmed）
runWebhookConfirmedTest();

// Webhookテスト（event_cancelled）- event_confirmedで作成したレコードが必要
runWebhookCancelledTest('event-id-here');
```

### 2. TimeRexで実際に予約を作成

1. 予約ページ（TimeRexウィジェット）を開く
2. 予約を作成
3. GASの実行ログを確認（**実行** > **実行ログ**）
4. interviewsシートを確認（新しい行が追加されているか）

### 3. 実行ログの確認

GASエディタで以下のログが出力されているか確認：

```
Event confirmed: {event_id}, row: {行番号}
```

エラーが発生している場合は、ログにエラーメッセージが表示されます。

## トラブルシューティング

### Webhookが受信されない

1. **Webhook URLが正しいか確認**
   - TimeRex管理画面 > チーム設定 > Integrations > Webhook でURLを確認
   - GASのデプロイIDと一致しているか確認

2. **GASの実行ログを確認**
   - GASエディタ > **実行** > **実行ログ** を開く
   - `doPost`関数が呼ばれているか確認
   - エラーメッセージを確認

3. **セキュリティトークンの検証**
   - 実行ログで「Invalid security token」エラーが表示される場合
   - GASのスクリプトプロパティで`TIMEREX_WEBHOOK_TOKEN`が正しく設定されているか確認

### interviewsシートに記録されない

1. **interviewsシートが存在するか確認**
   - GASエディタで`setupSpreadsheetSheets()`を実行してシートを作成

2. **実行ログでエラーを確認**
   - `WebhookHandler.handleEventConfirmed`のエラーを確認
   - 必須フィールドが不足していないか確認

3. **スプレッドシートIDが正しいか確認**
   - GASのスクリプトプロパティで`SPREADSHEET_ID`が正しく設定されているか確認

### セキュリティトークンが確認できない

TimeRexのWebhook設定画面でセキュリティトークンが表示されない場合：

1. **Webhook設定を削除して再作成**
   - 既存のWebhook設定を削除
   - 新しくWebhookを追加（この時にトークンが再生成される）

2. **GAS側でトークン検証をスキップ**
   - セキュリティトークンが設定されていない場合、GAS側で自動的に検証をスキップします
   - ただし、本番環境では推奨されません

## 実装されている処理

### event_confirmed（予約確定）

- interviewsシートに以下の情報を記録：
  - `created_at`: 予約作成日時
  - `start_at`: 予約開始日時
  - `end_at`: 予約終了日時
  - `guest_name`: ゲスト名
  - `guest_email`: ゲストメールアドレス（LINE連携の場合は空の場合がある）
  - `meet_url`: ミーティングURL（Zoom/Google Meet等）
  - `line_uid`: LINEユーザーID（URLパラメータから取得）
  - `source`: "TimeRex"
  - `event_id`: TimeRexイベントID
  - `team_url_path`: TimeRexチームURLパス
  - `calendar_url_path`: TimeRexカレンダーURLパス
  - `status`: 1（確定）

### event_cancelled（予約キャンセル）

- interviewsシートの該当レコードの`status`を3（キャンセル）に更新
- `event_id`でレコードを検索

## 参考

- [TimeRex Webhook リファレンス](https://developers.timerex.net/ja/webhook/reference/d25add815131b-english)
- [GAS Webアプリデプロイガイド](docs/WEB_APP_DEPLOYMENT.md)

