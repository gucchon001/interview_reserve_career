# Webhookデバッグガイド

## 問題: 予約がスプレッドシートに反映されない

予約は作成されているが、interviewsシートに記録されない場合のトラブルシューティング手順です。

## Webhookフロー

```
1. ユーザーがTimeRexで予約を作成
   ↓
2. TimeRexがWebhookをGASに送信（POST）
   URL: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
   ↓
3. GASのdoPost関数がWebhookを受信
   ↓
4. WebhookHandler.handleEventConfirmed()が呼ばれる
   ↓
5. SpreadsheetService.appendInterview()でinterviewsシートに記録
```

## デバッグ手順

### ステップ1: Webhook URLの確認

GASエディタで以下の関数を実行：

```javascript
getWebhookUrl();
```

表示されたURLをTimeRex管理画面のWebhook設定と比較してください。

**確認ポイント:**
- URLが完全に一致しているか
- デプロイIDが正しいか
- Google Workspace組織の場合は `/a/macros/{domain}/` が含まれているか

### ステップ2: Webhook受信の確認

TimeRexで予約を作成後、GASエディタ > **実行** > **実行ログ** で以下を確認：

#### 正常な場合のログ

```
[doPost] Webhook received
[doPost] postData: present
[doPost] Payload received (length: XXX chars)
[doPost] Payload parsed successfully
[doPost] Webhook type: event_confirmed
[doPost] Processing event_confirmed
[WebhookHandler] handleEventConfirmed called
[WebhookHandler] Event ID: {event_id}
[WebhookHandler] Validation passed
[WebhookHandler] Guest name: {name}, email: {email}
[WebhookHandler] Attempting to append interview data to spreadsheet...
[SpreadsheetService] appendInterview called
[SpreadsheetService] Sheet found: interviews
[SpreadsheetService] Successfully appended row: {row_number}
[WebhookHandler] Event confirmed: {event_id}, row: {row_number}
[doPost] event_confirmed processed: success=true, rowIndex={row_number}
[doPost] Returning success response
```

#### Webhookが受信されていない場合

ログに `[doPost] Webhook received` が表示されない場合：

1. **TimeRex側のWebhook URL設定を確認**
   - TimeRex管理画面 > チーム設定 > Integrations > Webhook
   - URLが正しく設定されているか確認

2. **GASのデプロイIDを確認**
   - GASエディタ > 公開 > デプロイを管理
   - 最新のデプロイの「WebアプリのURL」を確認
   - TimeRex側のURLと一致しているか確認

3. **Webhook URLの形式を確認**
   - Google Workspace組織の場合: `https://script.google.com/a/macros/{domain}/s/{DEPLOYMENT_ID}/exec`
   - 通常のGoogleアカウントの場合: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

### ステップ3: エラーログの確認

ログにエラーが表示されている場合、エラーメッセージを確認してください。

#### よくあるエラー

1. **`[doPost] ERROR: No postData.contents`**
   - Webhookのペイロードが正しく送信されていない
   - TimeRex側のWebhook設定を確認

2. **`[doPost] ERROR: Invalid security token`**
   - セキュリティトークンが一致しない
   - GASのスクリプトプロパティで`TIMEREX_WEBHOOK_TOKEN`を確認

3. **`[WebhookHandler] Validation failed: id, start_datetime, end_datetime`**
   - Webhookペイロードに必須フィールドが含まれていない
   - TimeRex側のWebhook設定を確認

4. **`[SpreadsheetService] ERROR in appendInterview`**
   - スプレッドシートへのアクセス権限がない
   - `SPREADSHEET_ID`が正しく設定されているか確認
   - `interviews`シートが存在するか確認（`setupSpreadsheetSheets()`を実行）

### ステップ4: スプレッドシートの確認

1. **interviewsシートが存在するか確認**
   - スプレッドシートを開く
   - `interviews`シートが存在するか確認
   - 存在しない場合: GASエディタで`setupSpreadsheetSheets()`を実行

2. **最新の行を確認**
   - interviewsシートの最後の行を確認
   - 予約作成時刻と一致する行があるか確認

3. **データの内容を確認**
   - `event_id`カラムにTimeRexのイベントIDが記録されているか
   - `guest_name`、`start_at`、`end_at`が正しく記録されているか

## テスト関数

### 1. Webhook URL確認

```javascript
getWebhookUrl();
```

TimeRex側で設定すべきWebhook URLを表示します。

### 2. Webhook受信テスト（シミュレーション）

```javascript
testWebhookReception();
```

Webhook URLの確認と、実際のWebhook受信テストの手順を表示します。

### 3. Webhook処理テスト（モックデータ）

```javascript
runWebhookConfirmedTest();
```

モックデータを使用してWebhook処理をテストします。interviewsシートにデータが追加されることを確認できます。

## トラブルシューティングチェックリスト

- [ ] TimeRex側でWebhook URLが設定されている
- [ ] Webhook URLがGASのデプロイIDと一致している
- [ ] GASの実行ログに`[doPost] Webhook received`が表示される
- [ ] セキュリティトークンが正しく設定されている（オプション）
- [ ] `SPREADSHEET_ID`が正しく設定されている
- [ ] `interviews`シートが存在する
- [ ] スプレッドシートへのアクセス権限がある
- [ ] エラーログにエラーメッセージが表示されていない

## 次のステップ

1. **Webhook URLを確認**: `getWebhookUrl()`を実行
2. **TimeRex側の設定を確認**: 表示されたURLがTimeRex管理画面に設定されているか確認
3. **予約を作成**: TimeRexで予約を作成
4. **実行ログを確認**: GASエディタ > 実行 > 実行ログ でWebhook受信を確認
5. **スプレッドシートを確認**: interviewsシートに新しい行が追加されているか確認

問題が解決しない場合は、実行ログの内容を共有してください。

