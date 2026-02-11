# TimeRex設定ガイド

## 概要

このドキュメントでは、GAS予約システムでTimeRexカレンダーウィジェットを使用するために必要なTimeRex側の設定手順を説明します。

## 必要な設定項目

### 1. カレンダーの公開設定（重要）

TimeRexカレンダーウィジェットを埋め込むには、カレンダーが**公開**されている必要があります。

**⚠️ エラー「404 Not Found / 対象のカレンダーが見つかりませんでした」が表示される場合、この設定が原因の可能性が高いです。**

#### 設定手順

1. TimeRex管理画面にログイン
2. **ダッシュボード** > **日程調整カレンダー** を開く
3. 使用するカレンダーを選択
   - **重要**: カレンダーが存在することを確認してください
4. **設定** > **公開設定** を開く
5. **「カレンダーを公開する」** にチェックを入れる
6. **保存** をクリック

#### 確認方法

- カレンダーが公開されている場合、以下のようなURLで直接アクセスできます：
  ```
  https://timerex.net/s/{team_url_path}/{calendar_url_path}
  ```
- このURLにブラウザでアクセスして、カレンダーが表示されることを確認してください
- **404エラーが表示される場合**:
  - カレンダーが公開されていない可能性があります
  - カレンダーURLパスが間違っている可能性があります
  - カレンダーが削除されている可能性があります

#### トラブルシューティング: 404エラーが表示される場合

1. **カレンダーの存在確認**
   - TimeRex管理画面 > **日程調整カレンダー** でカレンダーが表示されているか確認
   - カレンダーが削除されていないか確認

2. **公開設定の確認**
   - **設定** > **公開設定** で「カレンダーを公開する」にチェックが入っているか確認
   - チェックを入れて保存後、再度URLにアクセス

3. **カレンダーURLパスの確認**
   - **設定** > **埋め込みコード** セクションで表示されるURLを確認
   - GAS側の `TIMEREX_CALENDAR_URL_PATH` が正しいか確認
   - プロフィール画面の「チームID」と「日程調整API用team_id」が正しいか確認

4. **直接URLアクセステスト**
   - `https://timerex.net/s/26a251ae9cf9cd67fc85/y-haraguchi_6612` に直接アクセス
   - カレンダーが表示されれば公開設定は正しい
   - 404エラーが表示される場合は、カレンダーが存在しないか、URLパスが間違っています

### 2. カレンダーURLパスの確認

GAS側で使用する `TIMEREX_TEAM_URL_PATH` と `TIMEREX_CALENDAR_URL_PATH` を確認します。

#### 確認方法1: カレンダー設定画面から

1. TimeRex管理画面 > **日程調整カレンダー** を開く
2. 使用するカレンダーを選択
3. **設定** > **埋め込みコード** または **Embed Calendar** セクションを開く
4. 埋め込みコードに含まれるURLからパスを抽出：
   ```html
   <div id="timerex_calendar" data-url="https://timerex.net/s/26a251ae9cf9cd67fc85/y-haraguchi_6612"></div>
   ```
   - `team_url_path`: `26a251ae9cf9cd67fc85`（`/s/` と `/` の間）
   - `calendar_url_path`: `y-haraguchi_6612`（最後の `/` の後）

#### 確認方法2: カレンダーURLから直接確認

1. TimeRex管理画面 > **日程調整カレンダー** を開く
2. 使用するカレンダーを選択
3. カレンダーのURLを確認（ブラウザのアドレスバーまたは共有リンク）
4. URL形式: `https://timerex.net/s/{team_url_path}/{calendar_url_path}`
   - 例: `https://timerex.net/s/26a251ae9cf9cd67fc85/y-haraguchi_6612`
   - `team_url_path` = `26a251ae9cf9cd67fc85`
   - `calendar_url_path` = `y-haraguchi_6612`

### 3. GAS側のスクリプトプロパティ設定

TimeRex側で確認したURLパスを、GASのスクリプトプロパティに設定します。

#### 3.1 統合カレンダーの設定

統合カレンダーは、複数の面談官の空き時間を表示するために使用します。

**設定方法1: GASエディタから直接設定**

1. GASエディタを開く
2. **プロジェクトの設定**（歯車アイコン）をクリック
3. **スクリプトプロパティ** セクションで以下を追加：

| プロパティキー | 値 | 説明 |
|--------------|-----|------|
| `TIMEREX_TEAM_URL_PATH` | `y-haraguchi_6612` | TimeRexチームURLパス |
| `TIMEREX_TEAM_CALENDAR_URL_PATH` | `23a9cb5e` | 統合カレンダーのURLパス |

**設定方法2: スクリプト関数から設定**

GASエディタで以下の関数を実行：

```javascript
setScriptProperties({
  TIMEREX_TEAM_URL_PATH: 'y-haraguchi_6612',           // TimeRex側で確認したチームURLパス
  TIMEREX_TEAM_CALENDAR_URL_PATH: '23a9cb5e'          // 統合カレンダーのURLパス
});
```

#### 3.2 個別カレンダーの設定

個別カレンダーは、特定の面談官のみのスケジュールを表示するために使用します。

**設定手順**

1. TimeRex管理画面で、各面談官用の個別カレンダーを作成
   - 各カレンダーには、その面談官のみをメンバーとして追加
2. 各カレンダーの`calendar_url_path`を確認
   - カレンダー設定画面 > **埋め込みコード** セクションから確認
   - URL形式: `https://timerex.net/s/{team_url_path}/{calendar_url_path}`
3. `interviewers`シートの`timerex_config_id`カラム（C列）に、各面談官のカレンダーURLパスを手動で設定

**例:**

| id | name | timerex_config_id | google_calendar_id | priority |
|----|------|-------------------|-------------------|----------|
| y_haraguchi | 原口陽一郎 | `23a9cb5e` | y-haraguchi@tomonokai-corp.com | 1 |
| g_kawasaki | 川崎 | `abc12345` | g-kawasaki@tomonokai-corp.com | 2 |
| y_ozamoto | 尾座本 | `def67890` | y-ozamoto@tomonokai-corp.com | 3 |

**注意:**
- `timerex_config_id`は、その面談官が単独でメンバーとして含まれるカレンダーの`calendar_url_path`を設定してください
- 統合カレンダーとは別のカレンダーとして、TimeRex側で作成する必要があります

#### 3.3 設定確認

以下の関数で設定状況を確認：

```javascript
// 必須プロパティの設定状況を確認
validateScriptProperties();

// 予約画面URL生成テスト
runBookingPageTest();
```

#### 3.4 カレンダー構成の確認

**統合カレンダー:**
- URL: `https://timerex.net/s/{TIMEREX_TEAM_URL_PATH}/{TIMEREX_TEAM_CALENDAR_URL_PATH}`
- 例: `https://timerex.net/s/y-haraguchi_6612/23a9cb5e`
- 用途: `interviewer_id`パラメータなしの場合に使用
- メンバー: 全面談官が含まれる

**個別カレンダー:**
- URL: `https://timerex.net/s/{TIMEREX_TEAM_URL_PATH}/{interviewer.timerex_config_id}`
- 例: `https://timerex.net/s/y-haraguchi_6612/23a9cb5e`（面談官ごとに異なる）
- 用途: `interviewer_id`パラメータありの場合に使用
- メンバー: その面談官のみが含まれる

### 4. カレンダー設定（メールアドレスを任意にする）

LINE連携を使用する場合、メールアドレスを必須項目から外すことを推奨します。

#### 設定手順

1. TimeRex管理画面 > **日程調整カレンダー** を開く
2. 使用するカレンダーを選択
3. **設定** > **質問項目** を開く
4. **メールアドレス** 項目の設定を確認
5. **必須** のチェックを外す（任意項目にする）
6. **保存** をクリック

**注意:** この設定により、LINEユーザーがメールアドレスを入力せずに予約できるようになります。

### 5. Googleカレンダー連携設定（オプション）

TimeRexとGoogleカレンダーを連携させる場合の設定：

1. TimeRex管理画面 > **日程調整カレンダー** を開く
2. 使用するカレンダーを選択
3. **設定** > **外部カレンダー連携** を開く
4. **Googleカレンダー** を選択
5. Googleアカウントで認証
6. 連携するGoogleカレンダーを選択
7. **保存** をクリック

**注意:** この設定により、TimeRexで予約が確定すると自動的にGoogleカレンダーに予定が追加されます。

### 6. Webhook設定（オプション）

予約確定・キャンセル時にGASに通知を受け取る場合の設定：

1. TimeRex管理画面 > **チーム設定** > **Integrations** を開く
2. **Webhook** セクションで **追加** をクリック
3. **Webhook URL** に以下を入力：
   ```
   https://script.google.com/macros/s/{SCRIPT_ID}/exec
   ```
   - `{SCRIPT_ID}` は、GASのデプロイID（Webアプリとして公開した際のID）に置き換える
4. **セキュリティトークン** が表示されたら、それをコピー
5. **保存** をクリック
6. コピーしたセキュリティトークンをGASのスクリプトプロパティに設定：
   ```javascript
   setScriptProperties({
     TIMEREX_WEBHOOK_TOKEN: 'コピーしたセキュリティトークン'
   });
   ```

**注意:** セキュリティトークンは設定画面で確認できない場合があります。その場合は、GAS側でトークン検証をスキップする設定になっています。

## トラブルシューティング

### カレンダーが表示されない

1. **カレンダーが公開されているか確認**
   - TimeRex管理画面 > カレンダー設定 > 公開設定を確認
   - 公開されていない場合は公開設定を有効化

2. **URLパスが正しいか確認**
   - GASエディタで `runBookingPageTest()` を実行
   - 生成されたURLが正しい形式か確認
   - TimeRex側のURLと一致しているか確認

3. **ブラウザのコンソールでエラーを確認**
   - 予約ページを開いて、ブラウザの開発者ツール（F12）を開く
   - コンソールタブでエラーメッセージを確認
   - `Initializing TimeRex widget with URL:` のログでURLが正しく表示されているか確認

### 予約が確定しない

1. **Webhook設定を確認**
   - TimeRex管理画面 > チーム設定 > Integrations > Webhook を確認
   - Webhook URLが正しく設定されているか確認
   - GASの実行ログでWebhookが受信されているか確認

2. **Googleカレンダー連携を確認**
   - TimeRex側でGoogleカレンダー連携が設定されているか確認
   - 連携するGoogleカレンダーが正しく選択されているか確認

## 参考リンク

- [TimeRex カレンダーウィジェット埋め込みドキュメント](https://developers.timerex.net/ja/widget/nreference/1bbc771ccab48-calendar-widget-embed)
- [TimeRex API リファレンス](https://developers.timerex.net/ja/api/reference/6vmzg8z1h2tjg-api)
- [TimeRex Webhook リファレンス](https://developers.timerex.net/ja/webhook/reference/d25add815131b-english)

