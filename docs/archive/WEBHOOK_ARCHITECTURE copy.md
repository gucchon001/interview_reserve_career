# Webhook アーキテクチャ

LINE Messaging API の Webhook を受信する Google Apps Script の仕組みを整理したドキュメントです。

---

## 1. 全体フロー

```
LINE Platform
    │ POST (JSON)
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Main.js: doPost(e)                                         │
│  - e.postData.contents を JSON パース                        │
│  - logEvent() でログ記録                                     │
│  - data.events をループしてイベント種別で振り分け            │
└─────────────────────────────────────────────────────────────┘
    │
    ├─ event.type === 'unfollow'  ──► EventHandlers.handleUnfollow()
    ├─ event.type === 'follow'    ──► EventHandlers.handleFollow()
    ├─ event.type === 'message'  ──► EventHandlers.handleMessage()
    └─ event.type === 'postback'  ──► EventHandlers.handlePostback()
```

- **入口**: `doPost(e)` のみ（LINE は POST で Webhook を送る）
- **応答**: 常に `ContentService.createTextOutput("Success")` で 200 を返す（LINE の要件）
- **実際の返信**: `replyToLine(replyToken, text)` または `pushToLine(userId, content)` で LINE API を呼ぶ

---

## 2. 現在のペイロード形式

LINE が POST で送る body は `e.postData.contents` の文字列を `JSON.parse` したオブジェクト。本プロジェクトで参照している形式は以下のとおり。

### 2.1 リクエスト全体（トップレベル）

```json
{
  "destination": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "events": [ /* 下記イベントオブジェクトの配列 */ ]
}
```

- **`events`**: 必須。イベントの配列（1リクエストに複数入ることがある）。
- **`destination`**: ボットのユーザーID。本コードでは未使用。

### 2.2 各イベントで共通に参照しているプロパティ

| プロパティ | 型 | 説明 |
|------------|-----|------|
| `event.type` | string | `"message"` \| `"postback"` \| `"follow"` \| `"unfollow"` |
| `event.timestamp` | number | イベント発生日時のミリ秒（Unix 時刻） |
| `event.source.userId` | string | 送信元ユーザーID |
| `event.replyToken` | string | 返信用トークン（message / postback で利用、要 1 回のみ使用） |

### 2.3 type === "message" のとき

本コードでは **テキストメッセージのみ** 処理する。

| プロパティ | 型 | 説明 |
|------------|-----|------|
| `event.message.type` | string | `"text"` のときのみ handleMessage で処理 |
| `event.message.text` | string | ユーザーが送ったテキスト |

### 2.4 type === "postback" のとき

| プロパティ | 型 | 説明 |
|------------|-----|------|
| `event.postback.data` | string | ボタンに設定したデータ。**プレーン文字列**または **JSON 文字列**（Lステップ互換）。 |

Lステップ／塾ブランド診断では、`event.postback.data` を JSON パースしたオブジェクトに **`text`** が含まれる形式を想定している。

例（JSON の場合）:
```json
{ "text": "【塾ブランド診断スタート！】" }
```
```json
{ "text": "【〇〇の質問への回答】" }
```

### 2.5 type === "follow" / "unfollow" のとき

共通の `event.source.userId` と `event.timestamp` のみ使用。他プロパティは参照していない。

---

## 3. イベント種別と処理先

| イベント種別 | 処理関数 | 主な処理内容 |
|-------------|----------|--------------|
| **unfollow** | `handleUnfollow` | ブロック時: シート `blocks` に userId・日時を記録 |
| **follow** | `handleFollow` | 友だち追加時: シート `newFriends` に userId・日時・メモを記録 |
| **message** | `handleMessage` | テキストメッセージ: ステート／トリガーに応じて検索・診断・テスト応答など（後述） |
| **postback** | `handlePostback` | ボタン押下: 診断開始・回答記録、または「駅名入力待ち」ステートへ |

---

## 4. メッセージ処理 (handleMessage) の分岐

テキストメッセージは次の順で判定される。

### 4.1 ステート経由（駅名入力待ち）

- **条件**: `StateManager.getState(userId) === 'WAITING_STATION'`
- **流れ**:
  1. 診断用トリガーや「▶　もう一度検索する！」は無視（二重処理防止）
  2. ローディング表示 → 利用回数チェック（1日10回）→ `recordMessageToSheet` → `StationJobSearchService.execute(userId, userMessage)`
- **ステート**: ポストバックで「早速検索」「もう一度検索」「駅名から探す」を押すと `WAITING_STATION` に設定され、次に送ったテキストが駅名として扱われる（有効期限 5 分）。

### 4.2 求人検索トリガー

- **条件**: `userMessage.startsWith(JOB_SEARCH_CONFIG.triggerPrefix)`  
  - デフォルト: `【最寄駅検索】`
- **流れ**: ローディング → 利用回数チェック → ログ記録 → `StationJobSearchService.execute(userId, userMessage)`
- **実装**: `StationJobSearch.js`（BigQuery で駅名・指導形態から求人検索し、Flex で返信）

### 4.3 自動応答テスト

- **条件**: `userMessage === 'これは自動応答テストです'`
- **流れ**: ログ記録 → `replyToLine(replyToken, 'テスト成功です')`

### 4.4 その他

- 上記のいずれにも該当しない場合は `recordMessageToSheet` のみ（ログに残すだけ）。

---

## 5. ポストバック処理 (handlePostback) の分岐

`event.postback.data` は JSON 文字列のことがある（Lステップ互換）。

### 5.1 塾ブランド診断（JSON + text）

- **条件**: `postback.data` を JSON パースし、`postbackJson.text` が存在
  - **開始**: `TRIGGERS.START_LIST` に含まれる → `BrandDiagnosisService.handleDiagnosisEvent`（診断開始）
  - **回答**: `text` が `【...】` 形式 → 同様に `BrandDiagnosisService.handleDiagnosisEvent`（回答記録）

### 5.2 駅名検索モード開始（文字列一致）

- **条件**: `dataStr` に次のいずれかが含まれる  
  - `【▶　早速検索してみる！】`  
  - `hello`（「もう一度検索する」ボタン）  
  - `駅名から探す！`
- **流れ**: `StateManager.setState(userId, WAITING_STATION)`  
  - `hello` のときのみ `replyToLine(..., "【検索モードを起動しました（5分間有効）】\n駅名を入力してください！")`

---

## 6. 主要な依存関係

| 役割 | ファイル | 内容 |
|------|----------|------|
| 入口・設定 | `Main.js` | `doPost`, シート名・Slack/LINE トークン定数 |
| イベント振り分け | `EventHandlers.js` | `handleMessage`, `handlePostback`, `handleFollow`, `handleUnfollow`, `logEvent`, `recordMessageToSheet` |
| LINE API | `LineApi.js` | `replyToLine`, `pushToLine`, `startLoadingAnimation`, `getUserProfile` |
| 状態管理 | `StateManager.js` | `WAITING_STATION` の set/get/clear（PropertiesService, 5分 TTL） |
| 求人検索 | `StationJobSearch.js`, `JobSearchConfig.js` | トリガー文言・BigQuery 検索・回数制限 |
| 塾ブランド診断 | `BrandDiagnosisService.js`, `BrandDiagnosisConfig.js` | 診断開始・回答記録・動的設定 |

---

## 7. デプロイ・セキュリティ上の注意

- **Web アプリ**: `appsscript.json` の `webapp.access: "ANYONE_ANONYMOUS"` で、LINE のサーバーから POST を受け付ける。
- **認証**: LINE の Webhook 検証は本実装では行っていない。必要なら署名検証（`X-Line-Signature`）の追加を検討する。
- **トークン**: `CHANNEL_ACCESS_TOKEN` と Slack の Webhook URL は `Main.js` に直書きされている。本番ではスクリプトプロパティや環境変数での管理を推奨。

---

## 8. シート利用一覧

| シート名 | 用途 |
|----------|------|
| log | 受信 JSON やエラーのログ |
| blocks | ブロック（unfollow）した userId・日時 |
| newFriends | 友だち追加（follow）した userId・日時・メモ |
| message | メッセージログ（日時, userId, 本文）・求人検索回数集計の元 |
| data | （StationJobSearch 等で利用） |
| 目標 | （設定等） |
| CVdata | （設定等） |
| brandLog | 塾ブランド診断の回答ログ |
| userList | 診断ユーザーリスト |
| pushLog | 診断関連プッシュログ |
| diagnosisConfig | 診断の動的設定 |

---

*最終更新: プロジェクト構成に基づく整理*
