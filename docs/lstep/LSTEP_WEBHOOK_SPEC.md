# L-step Webhook転送機能 実装仕様書

## 1. 概要

L-stepのWebhook転送機能を使用して、LINE公式アカウントで発生したイベント（ボタンタップ等）をGAS側で受信し、UIDを取得して面談予約システムにリダイレクトする仕組みです。

### 参考資料
- [L-step Webhook転送機能の公式記事](https://linestep.jp/2025/06/13/lstep-webhook/)
- [LINE Developers - メッセージ（Webhook）を受信する](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)

## 2. 重要な前提条件

### 2.1 URLにUIDは埋め込めない
- L-stepのURLパラメータに直接UIDを含めることはできません
- **Webhook転送でUIDを転送することしかできません**

### 2.2 UIDの把握はボタンタップによって行う
- メッセージ内のボタンをタップした際に、L-stepのWebhook転送でUIDを取得します
- LINE公式アカウントの標準イベントとして確実に動作します

### 2.3 Webhook転送データは外部への一方向のみ
- L-stepから外部への一方向（LINE公式アカウント→Lステップ→外部）
- タグ情報などのLステップのデータは送信されない
- **受信先のシステムでWebhook URLの発行が必要**

### 2.4 【重要】postback と URI の違い（doPost のみにすること）

| ボタン種別 | 発生するリクエスト | ユーザーが見るレスポンス |
|-----------|-------------------|-------------------------|
| **URI** | doGet（ブラウザ）＋ doPost（Webhook転送） | doGet のレスポンス＝UID取得失敗 |
| **postback** | doPost のみ | なし（LINE内に留まる） |

**動作するプロジェクトは doPost のみ。** URI ボタンだと doGet も呼ばれ、GET には POST ボディがないため UID を取得できずエラーになる。**ボタンは postback にすること。**

## 3. URLの種類と用途

**重要:** GASのURLは**スクリプトID**（`/macros/s/{SCRIPT_ID}/exec`）ではなく、**デプロイURL**（ウェブアプリとしてデプロイしたURL）を使用します。ドメイン付きの例: `https://script.google.com/a/macros/{ドメイン}/s/{デプロイID}/exec`。`getLStepWebhookEndpointUrl()` の実行ログに表示されるURL（`Config.BOOKING_BASE_URL` ベース）をそのまま使ってください。

### 3.1 Webhook転送エンドポイントURL（L-step管理画面で設定）
```
https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycb.../exec
```
- **用途**: L-step管理画面の「LINE Webhook転送設定」に設定（L-stepが**POST**でイベントを送る先）
- **送信方法**: POSTリクエスト（LINE公式アカウントのWebhookデータを転送）
- **設定場所**: L-step管理画面 > 「アカウント設定」 > 「外部連携設定」タブ > 「LINE Webhook転送設定」
- 上記は**デプロイURL**。実際の値は `getLStepWebhookEndpointUrl()` で確認。

**⚠️ 重要: Webhook転送URLには `?action=lstep_webhook` を付けないこと。**
- クエリパラメータを付けると L-step が POST 本文を転送せず、UID 取得に失敗する
- **ベースURLのみ**を指定する（末尾に `?` や `&` を付けない）

### 3.2 ボタンの設定（postback 推奨）

**推奨: postback ボタン ＋ シナリオでメッセージ送信**
- **ボタン**: アクション postback、data `{"action":"booking","interviewer_id":"tanaka"}`（JSON文字列）
- **シナリオ**: postback 受信 → テキスト＋URL のメッセージを送る。URL 例: `https://.../exec?action=lstep_webhook&interviewer_id=tanaka`
- **流れ**: ①postback タップ → POST で UID・セッション作成 ②メッセージでURL受信 ③URLクリック → GET で interviewer_id に紐づくセッションを検索 → 予約ページへリダイレクト

### 3.3 面談予約URL（リダイレクト先）
```
https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycb.../exec?session_id={SESSION_ID}&interviewer_id={INTERVIEWER_ID}
```
- **用途**: `handleLStepWebhook`関数内で生成されるリダイレクト先（`Config.BOOKING_BASE_URL` を使用）
- **生成タイミング**: Webhook転送受信後、セッションID生成後
- **処理**: `handleBookingPage`関数が呼び出され、ユーザーが予約を行う

## 4. データフロー

### 4.1 全体フロー

```
【ステップ1】ユーザーがボタンをタップ
  ↓
【ステップ2】L-stepがWebhook転送を実行（POST）
  → Webhook転送エンドポイントURLにPOSTリクエスト
  → LINE公式アカウントのイベントデータ（UID含む）を転送
  ↓
【ステップ3】GAS側でWebhook転送を受信
  → doPost()関数が呼び出される
  → action=lstep_webhookの場合、handleLStepWebhook()を実行
  ↓
【ステップ4】UIDの抽出とセッションID生成
  → POSTデータからUIDを抽出
  → セッションIDを生成（Utilities.getUuid()）
  → CacheServiceとスプレッドシートに保存
  ↓
【ステップ5】面談予約URLにリダイレクト
  → セッションIDを含むURLを生成
  → HTMLレスポンスでリダイレクト（meta refresh + JavaScript）
  ↓
【ステップ6】予約画面でUIDを取得
  → handleBookingPage()関数が呼び出される
  → セッションIDからUIDを取得（CacheService優先、スプレッドシートフォールバック）
  → TimeRexウィジェットにUIDを渡す
```

### 4.2 詳細フロー

#### ステップ1: ボタンタップ
- ユーザーがL-stepのメッセージ内のボタンをタップ
- **postback の場合**: ブラウザは開かず、L-step へ Webhook イベントが送られる
- **URI の場合**: ブラウザで URL が開く（doGet）＋ Webhook 転送（doPost）の両方が発生

#### ステップ2: Webhook転送
- L-stepが「LINE Webhook転送設定」で設定されたURLにPOSTリクエストを送信
- LINE公式アカウントのイベントデータが転送される
- ペイロードにUIDが含まれる

#### ステップ3: GAS側で受信
- `doPost()`関数が呼び出される
- `e.parameter.action === 'lstep_webhook'`の場合、`handleLStepWebhook()`を実行
- POSTデータからUIDを抽出

#### ステップ4: UIDの保存
- セッションIDを生成（`Utilities.getUuid()`）
- CacheServiceに保存（高速取得用、10分有効期限）
- スプレッドシートに保存（履歴用、UIDと名前を保存）

#### ステップ5: リダイレクト / リンク送信
- **postback → メッセージでURL送信 → ユーザーがURLクリック**（推奨フロー）:
  1. ユーザーが postback タップ → POST で UID 取得、セッション作成（interviewer_id を postback.data から取得）
  2. L-step シナリオで「テキスト＋URL」のメッセージを送る（URL 例: `...?action=lstep_webhook&interviewer_id=tanaka`）
  3. ユーザーがその URL をクリック → GET。interviewer_id で直近2分以内のセッションを検索し、予約ページへリダイレクト

#### ステップ6: 予約画面でUID取得
- `handleBookingPage()`関数が呼び出される
- セッションIDからUIDを取得（CacheService優先、スプレッドシートフォールバック）
- TimeRexウィジェットの`url_params`にUIDを設定

## 5. 実装仕様

### 5.1 GAS側の実装

#### doPost()関数
```javascript
function doPost(e) {
  // L-step Webhook転送の処理（POSTリクエストの場合）
  const action = e.parameter.action;
  if (action === 'lstep_webhook') {
    Logger.log('[doPost] L-step Webhook転送を検出（POSTリクエスト）');
    return handleLStepWebhook(e);
  }
  // ... TimeRex Webhookの処理
}
```

#### doGet()関数
```javascript
function doGet(e) {
  const action = e.parameter.action;
  
  // L-step Webhook転送の処理（GETリクエストの場合）
  if (action === 'lstep_webhook') {
    return handleLStepWebhook(e);
  }
  // ... その他の処理
}
```

#### handleLStepWebhook()関数
```javascript
function handleLStepWebhook(e) {
  // 1. POSTデータからUIDを抽出
  // 2. セッションIDを生成
  // 3. CacheServiceとスプレッドシートに保存
  // 4. 面談予約URLにリダイレクト
}
```

### 5.2 UIDの抽出方法

POSTデータからUIDを抽出する際は、以下のパターンを試行：

```javascript
uid = parsedPayload.uid || 
      parsedPayload.user_id || 
      parsedPayload.line_user_id || 
      parsedPayload.source?.userId || 
      parsedPayload.events?.[0]?.source?.userId || 
      '';
```

### 5.3 セッション管理

#### CacheService（高速取得用）
- キー: `uid_{sessionId}`
- 有効期限: 600秒（10分）
- 用途: 高速なUID取得

#### スプレッドシート（履歴用）
- シート名: `uidlog`
- カラム: `日時`, `uid`, `sessionid`, `イベント種別`
- 用途: 履歴保存、フォールバック、デバッグ

### 5.4 リダイレクト処理

```javascript
// Config.BOOKING_BASE_URL（デプロイURL）を使用。未設定時のみ scriptId で組み立てる
const baseUrl = (Config.BOOKING_BASE_URL && Config.BOOKING_BASE_URL.trim()) !== ''
  ? Config.BOOKING_BASE_URL.replace(/\/$/, '')
  : `https://script.google.com/macros/s/${ScriptApp.getScriptId()}/exec`;
const redirectUrl = `${baseUrl}?session_id=${sessionId}${interviewerId ? '&interviewer_id=' + interviewerId : ''}`;

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
    <p>リダイレクト中...</p>
    <script>
      window.location.href = '${redirectUrl}';
    </script>
  </body>
  </html>
`);
```

## 6. 設定手順

### 6.1 L-step管理画面での設定

#### ステップ1: Webhook転送の設定
1. L-step管理画面にログイン
2. 「アカウント設定」 > 「外部連携設定」タブを開く
3. 「LINE Webhook転送設定」に**GASのデプロイURL（ベースURLのみ）**を入力。
   - GASで `getLStepWebhookEndpointUrl()` を実行し、ログに表示されるURLをコピー
   - **`?action=lstep_webhook` などクエリパラメータは付けない**（付けるとUID取得に失敗）
4. 保存

#### ステップ2: ボタンの設定（テンプレート機能）
※ 詳細は下記「[ボタンの設置方法（詳細）](#ボタンの設置方法詳細)」を参照。

1. L-step管理画面 > 「テンプレート」 > 新規作成
2. フレックスメッセージまたはカルーセルメッセージで「予約する」ボタンを配置
3. ボタンのアクション: 「URIアクション」を選択
4. URI: **デプロイURL** + `?action=lstep_webhook&interviewer_id=xxx`（例: `getLStepWebhookEndpointUrl()` で表示されるURLに `&interviewer_id=tanaka` を付与）
   - 注意: スクリプトID（`/macros/s/1LFzDp_.../exec`）ではなく**デプロイURL**（例: `/a/macros/ドメイン/s/デプロイID/exec`）を使用する
   - `interviewer_id`は実際の面談官IDに置き換える
   - 担当者ごとに異なるテンプレートを作成することを推奨
5. 保存

##### ボタンの設置方法（詳細）

1. **L-step管理画面にログイン**し、左メニューから **「テンプレート」** を開く。
2. **「新規作成」**（または既存テンプレートの編集）をクリック。
3. **フレックスメッセージ** または **カルーセルメッセージ** を選択し、メッセージを組み立てる。
4. **ボタン（アクション）を1つ追加**する。
   - ボタンラベル例: 「予約する」「面談予約はこちら」など。
5. そのボタンの **アクション種類** で **「URI」**（URIアクション）を選ぶ。
6. **URI（URL）** に次の形式で入力する（すべて1行で、改行なし）:
   ```
   https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbzwxXeBDR8LeHoYd5i4CRb2IElFR1AQcPzPg49ra4rYQc_njNox8LWIxlSMnAPHE25L_w/exec?action=lstep_webhook&interviewer_id=担当者ID
   ```
   - **必ずデプロイURLを使用**する（`/a/macros/ドメイン/s/デプロイID/exec` の形式）。スクリプトID（`/macros/s/1LFzDp_.../exec`）は使わない。
   - `担当者ID` の部分は、面談官ごとのID（例: `tanaka`）に置き換える。担当者ごとに別テンプレートにする場合は、それぞれの `interviewer_id` を設定する。
   - 実際のデプロイURLは GAS で **`getLStepWebhookEndpointUrl()`** を実行したときにログに表示される。そのURLの末尾に `&interviewer_id=xxx` を付けたものをそのままコピーして使ってよい。
7. **保存**してテンプレートを登録する。
8. **シナリオ配信** または **一斉配信** で、このテンプレートを送信すると、友だちのトークにボタン付きメッセージが届く。友だちがそのボタンをタップすると、ブラウザで上記URLが開き、あわせて L-step から Webhook転送（POST）が GAS に送られる。

### 6.2 GAS側の設定

#### ステップ1: Webアプリとしてデプロイ
1. GASエディタ > 「公開」 > 「デプロイを管理」
2. 「新しいデプロイ」 > 「種類の選択」で「ウェブアプリ」を選択
3. 「次のユーザーとして実行」を「自分」に設定
4. 「アクセスできるユーザー」を「全員」に設定
5. 「デプロイ」をクリック

#### ステップ2: Webhook URLの確認
GASエディタで以下の関数を実行：
```javascript
getLStepWebhookEndpointUrl()
```
実行ログに表示される**デプロイURL**（`Config.BOOKING_BASE_URL` ベース）を確認し、L-stepの「LINE Webhook転送設定」およびボタンのURIにそのURLを使用する。

## 7. テスト方法

### 7.1 モックテスト
GASエディタで以下の関数を実行：
```javascript
runAllLStepSessionTests()
```

### 7.2 実際のWebhook転送テスト
1. L-step管理画面でWebhook転送を設定
2. テンプレートを配信（ステップ配信または一斉配信）
3. ユーザーが「予約する」ボタンをタップ
4. GASの実行ログで以下を確認：
   - `[doPost]`または`[handleLStepWebhook]`で始まるログ
   - 受信したペイロードの形式
   - UIDが正しく抽出されたか
   - セッションIDが生成されたか
   - リダイレクトURLが正しく生成されたか

## 8. ログ出力

### 8.1 デバッグ用ログ
以下の情報をログ出力：
- 受信時刻
- POSTデータの詳細（Type, Length, Contents）
- パース後のペイロード
- 抽出されたUID
- 生成されたセッションID
- リダイレクトURL

### 8.2 エラーハンドリング
- UIDが取得できない場合: エラーページを返す
- セッション保存に失敗した場合: 警告ログを出力し、処理を続行（CacheServiceに保存されているため）

## 9. 注意事項

### 9.1 Webhook転送の制限
- Webhook転送データは外部への一方向のみ
- タグ情報などのLステップのデータは送信されない
- LINE公式アカウントで発生したイベントのみが対象

### 9.2 セキュリティ
- ブラウザのセキュリティ: 同じドメイン（`script.google.com`）内へのリダイレクトのため、セキュリティアラートは表示されません
- セッションIDはUUIDを使用（推測困難）

### 9.3 パフォーマンス
- CacheServiceを優先的に使用（高速取得）
- スプレッドシートはフォールバック用（履歴保存も兼ねる）

## 10. トラブルシューティング

### 10.1 UIDが取得できない場合（「POST Data is not available」が出る場合）
- **Webhook転送URLに `?action=lstep_webhook` を付けていないか確認**（ベースURLのみにすること）
- ログに `paramKeys=[action]` かつ `POST Data is not available` の場合は、Webhook転送URLのクエリを削除して再設定
- POSTデータの形式を確認（`uidlog` シートの `WEBHOOK_RECEIVED` 行）
- L-step管理画面でWebhook転送が正しく設定されているか確認

### 10.2 リダイレクトが動作しない場合
- セッションIDが正しく生成されているか確認
- リダイレクトURLが正しく生成されているか確認
- ブラウザのコンソールでエラーを確認

### 10.3 セッションが保存されない場合
- スプレッドシートの権限を確認
- CacheServiceの有効期限を確認
- GASの実行ログでエラーを確認

## 11. 関連ファイル

- `src/Code.gs`: `doGet()`, `doPost()`, `handleLStepWebhook()`, `handleBookingPage()`
- `src/SpreadsheetService.gs`: `getOrCreateUidlogSheet()`, `saveToUidlog()`, `getUidFromSessionSpreadsheet()`
- `src/Config.gs`: `SHEET_NAMES.UIDLOG`
- `src/TestApi.gs`: `runAllLStepSessionTests()`, `getLStepWebhookEndpointUrl()`, `prepareLStepWebhookTest()`

## 12. 更新履歴

- 2025-01-XX: 初版作成
  - L-step Webhook転送機能の実装仕様を整理
  - URLの種類と用途を明確化
  - データフローと実装仕様を詳細化
