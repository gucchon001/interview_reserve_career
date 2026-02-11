# Webhookトラブルシューティング

## 問題: 予約がスプレッドシートに反映されない（デバッグログが表示されない）

## 確認手順

### ステップ1: 最新のコードをデプロイ

デバッグログを追加したコードがデプロイされているか確認してください。

```bash
clasp push
```

**重要:** コードを変更した後は、必ず`clasp push`を実行してから、GASエディタで**公開 > デプロイを管理**から新しいデプロイを作成してください。

### ステップ2: Webhook URLの再確認

GASエディタで以下の関数を実行：

```javascript
getWebhookUrl();
```

**確認ポイント:**
1. 表示されたURLをコピー
2. TimeRex管理画面 > チーム設定 > Integrations > Webhook を開く
3. 設定されているWebhook URLと比較
4. **完全に一致しているか確認**（デプロイIDが最新か）

### ステップ3: 新しいデプロイを作成

コードを変更した場合、新しいデプロイを作成する必要があります：

1. GASエディタ > **公開** > **デプロイを管理** を開く
2. **新しいデプロイ** をクリック
3. **種類の選択** で **ウェブアプリ** を選択
4. **説明** を入力（例: "Webhook endpoint with debug logs"）
5. **次のユーザーとして実行** を **自分** に設定
6. **アクセスできるユーザー** を **全員** に設定
7. **デプロイ** をクリック
8. **WebアプリのURL** をコピー

### ステップ4: TimeRex側のWebhook URLを更新

1. TimeRex管理画面 > チーム設定 > Integrations > Webhook を開く
2. 既存のWebhook設定を**削除**
3. **追加** をクリック
4. ステップ3でコピーした**最新のWebアプリのURL**を貼り付け
5. **セキュリティトークン**が表示されたら、それをコピー
6. **保存** をクリック

### ステップ5: セキュリティトークンを設定（オプション）

セキュリティトークンが表示された場合：

1. GASエディタ > **プロジェクトの設定**（歯車アイコン）をクリック
2. **スクリプトプロパティ** セクションで以下を追加：

| プロパティキー | 値 |
|--------------|-----|
| `TIMEREX_WEBHOOK_TOKEN` | `コピーしたセキュリティトークン` |

または、GASエディタで以下の関数を実行：

```javascript
function setWebhookToken() {
  const token = 'コピーしたセキュリティトークン'; // ここに実際のトークンを貼り付け
  PropertiesService.getScriptProperties().setProperty('TIMEREX_WEBHOOK_TOKEN', token);
  Logger.log('Webhook token set successfully');
}
```

### ステップ6: 予約を作成してテスト

1. 予約ページ（TimeRexウィジェット）から予約を作成
2. GASエディタ > **実行** > **実行ログ** を開く
3. 以下を確認：

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
[SpreadsheetService] appendInterview called
[SpreadsheetService] Successfully appended row: {row_number}
```

#### Webhookが受信されていない場合

ログに `[doPost] Webhook received` が表示されない場合：

1. **TimeRex側のWebhook URLを再確認**
   - ステップ3で取得した最新のURLと一致しているか
   - デプロイIDが正しいか

2. **TimeRex側でWebhookが送信されているか確認**
   - TimeRex管理画面で予約履歴を確認
   - Webhook送信履歴があるか確認（TimeRex側で確認可能な場合）

3. **GASの実行ログをフィルタリング**
   - 実行ログで「doPost」で検索
   - 他の関数のログに埋もれていないか確認

## よくある問題

### 問題1: デプロイIDが古い

**症状:** ログに`[doPost] Webhook received`が表示されない

**原因:** TimeRex側のWebhook URLが古いデプロイIDを指している

**解決方法:**
1. 最新のデプロイIDを取得（ステップ3）
2. TimeRex側のWebhook URLを更新（ステップ4）

### 問題2: コードがデプロイされていない

**症状:** ログに`[doPost] Webhook received`が表示されない

**原因:** `clasp push`を実行していない、または新しいデプロイを作成していない

**解決方法:**
1. `clasp push`を実行
2. 新しいデプロイを作成（ステップ3）

### 問題3: セキュリティトークンが一致しない

**症状:** ログに`[doPost] ERROR: Invalid security token`が表示される

**原因:** GAS側とTimeRex側のセキュリティトークンが一致していない

**解決方法:**
1. TimeRex側で新しいセキュリティトークンを取得
2. GAS側のスクリプトプロパティを更新（ステップ5）

## デバッグログの確認方法

GASエディタ > **実行** > **実行ログ** で以下を確認：

1. **`[doPost] Webhook received`** - Webhookが受信されたか
2. **`[doPost] Payload received`** - ペイロードが正しく受信されたか
3. **`[WebhookHandler] handleEventConfirmed called`** - ハンドラーが呼ばれたか
4. **`[SpreadsheetService] appendInterview called`** - スプレッドシートへの記録が試みられたか
5. **`[SpreadsheetService] Successfully appended row: X`** - スプレッドシートへの記録が成功したか

エラーメッセージが表示されている場合は、その内容を確認してください。

